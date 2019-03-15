const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const app = express();
const db = require("./database");
const { NFC } = require("nfc-pcsc");

const nfc = new NFC();

nfc.on('reader', reader => {
	
 
    reader.on('card', card => {
 
        // card is object containing following data
        // [always] String type: TAG_ISO_14443_3 (standard nfc tags like MIFARE) or TAG_ISO_14443_4 (Android HCE and others)
        // [always] String standard: same as type
        // [only TAG_ISO_14443_3] String uid: tag uid
        // [only TAG_ISO_14443_4] Buffer data: raw data from select APDU response
 
        console.log(`${reader.reader.name}  card detected`, card);
 
    });
 
    reader.on('card.off', card => {
        console.log(`${reader.reader.name}  card removed`, card);
    });
 
    reader.on('error', err => {
        console.log(`${reader.reader.name}  an error occurred`, err);
    });
 
    reader.on('end', () => {
        console.log(`${reader.reader.name}  device removed`);
    });
 
});
 
nfc.on('error', err => {
    console.log('an error occurred', err);
});

const corsOptions = {
	origin: "*",
	optionsSuccessStatus: 200
};

// Middleware
app.use(
	compression(),
	cors(corsOptions), // User CORS to restric connections from anywhere other than localhost
	bodyParser.json() // Parse JSON requests
);

// Start the server!
const server = app.listen(8080, () => {
	console.log("Server started...\nPORT: 8080");
});

// Server is on and is ready to listen and respond!
server.on("listening", () => {
	// Initialize database.
	db.connect();
	employees = db.getEmployees((employees) => {
		//console.log("Connected to the DB and got employees (", employees.length, "): \n", employees);
	});
});

// Create employee file in relative folder and add the employee to they employee array.
app.post("/createEmployee", (req, res) => {
	db.addEmployee(req.body, () => {
		res.end();
	});
});

// Send the client the full list of employees.
app.post("/getEmployees", (req, res) => {
	db.getEmployees((employees) => {
		res.send(employees);
		res.end();
	});
});

// Send the client a signle employee by ID.
app.post("/getEmployee", (req, res) => {
	db.getEmployee(req.body.id, (employee) => {
		res.send(employee);
		res.end();
	});
});

// Send the client a signle employee by ID.
app.post("/getEmployeeWorkLog", (req, res) => {
	db.getEmployeeWorkLog(req.body.id, (workLog) => {
		res.send(workLog);
		res.end();
	});
});

// Toggle the employee"s working state
app.post("/setEmployeeWorking", (req, res) => {
	db.setEmployeeWorking(req.body.id, req.body.working, () => {
		res.end();
	});
});

// Delete the employee from it's ID
app.post("/deleteEmployee", (req, res) => {
	db.deleteEmployee(req.body.id, () => {
		res.end();
	});
});

// Edit the employee's data
app.post("/editEmployee", (req, res) => {
	db.editEmployee(req.body.employee, () => {
		res.end();
	});
});