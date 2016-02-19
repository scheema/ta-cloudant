/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*eslint-env node */
'use strict';

var express = require('express'),
  app = express(),
  bluemix = require('./config/bluemix'),
  watson = require('watson-developer-cloud'),
  extend = require('util')._extend;
  
// added by Srinivas Cheemalapati 20160112
var db;
var cloudant;
var dbCredentials = {
	// name of the database created in cloudant
	dbName : 'finance_db'
};


function initDBConnection() {
	console.log('Executing the initDBConnection - app.js');
	
	if(process.env.VCAP_SERVICES) {
		var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
		if(vcapServices.cloudantNoSQLDB) {
			dbCredentials.host = vcapServices.cloudantNoSQLDB[0].credentials.host;
			dbCredentials.port = vcapServices.cloudantNoSQLDB[0].credentials.port;
			dbCredentials.user = vcapServices.cloudantNoSQLDB[0].credentials.username;
			dbCredentials.password = vcapServices.cloudantNoSQLDB[0].credentials.password;
			dbCredentials.url = vcapServices.cloudantNoSQLDB[0].credentials.url;
		} else {
			console.log('Could not find Cloudant credentials in VCAP_SERVICES environment variable');
		}
	} else{
		console.log('VCAP_SERVICES environment variable not set');

	}

    console.log('Creating cloudant variable requiring cloudant module in apps.js ' + db);
	cloudant = require('cloudant')(dbCredentials.url);
	
	// check if DB exists if not create
	cloudant.db.create(dbCredentials.dbName, function (err, res) {
		if (err) { console.log('Srinivas: Could not create db ', err); }
    });
	db = cloudant.use(dbCredentials.dbName);
	console.log('Using the existing database name - index.js ' + db);



	// Hack: Srinivas Cheemalapati 20160112
	// Code to read the document from the cloudant database
	var jsonData;
	db.get("finance", /* @callback */ function(err, data) {
	// The rest of your code goes here. For example:
    	console.log('Reading the JSON Document from Cloudant Database ');
   		if(err){
   			console.log ('The Databases finance is not found - using default finance.json');
			return;  		
   		}
   	 // delete the id, revision properties
  	 	delete data._id;
    	delete data._rev;
    	
    	var fs = require('fs');
    	
    	//if (fs.existsSync('public/problems/finance.json')) {
    	//console.log('Found file finance.json -- deleting it');
    	//fs.unlinkSync('public/problems/finance.json');
		//}
    
    	jsonData = JSON.stringify(data);
    	console.log('Found finance: ', jsonData);
    
    	// Hack: Srinivas Cheemalapati 09092015
		// Write the read data finance.json into the public folder



		console.log('Ready to create the JSON data file in problems folder and file path: ' + __dirname);
	
		// Hack: Writing into the same file name as the original ?? 
		fs.writeFile('public/problems/finance.json', jsonData, function (err) {
  			if (err) return console.log(err);
  			console.log('Successfully created the file');
		});    
  	});
  
 }

initDBConnection();
console.log('Completed initDBConnection - index.js ' + db);


//avoid "request too large" exception
var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(express.static('minimum'));

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials = extend({
  version: 'v1',
  username: '<username>',
  password: '<password>'
}, bluemix.getServiceCreds('tradeoff_analytics')); // VCAP_SERVICES

// Create the service wrapper
var tradeoffAnalytics = watson.tradeoff_analytics(credentials);

// render index page
app.get('/', function(req, res) {
  res.render('index');
});

app.post('/demo/dilemmas/', function(req, res) {
  var params = extend(req.body);
  params.metadata_header = getMetadata(req);
  
  tradeoffAnalytics.dilemmas(params, function(err, dilemma) {
    if (err) 
      return res.status(Number(err.code) || 502).send(err.error || err.message || 'Error processing the request');
    else
      return res.json(dilemma);
  });
});

app.post('/demo/events/', function(req, res) {
  var params = extend(req.body);
  params.metadata_header = getMetadata(req);
  
  tradeoffAnalytics.events(params, function(err) {
    if (err)
      return res.status(Number(err.code) || 502).send(err.error || err.message || 'Error forwarding events');
    else
      return res.send();
  });
});

function getMetadata(req) {
	var metadata = req.header('x-watson-metadata');
	if (metadata) {
		metadata += "client-ip:" + req.ip;
	}
	return metadata;
}

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
