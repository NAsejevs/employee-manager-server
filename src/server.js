const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const app = express();
const Cookies = require("universal-cookie");
const db = require("./database");

const corsOptions = {
	credentials: true,
	origin: "http://localhost:3000",
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

// Add a new employee to the database
app.post("/addEmployee", (req, res) => {
	db.addEmployee(req.body, (employee) => {
		res.send(employee);
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
	console.log(req.body);
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

// Received scanner information!
app.post("/cardScanned", (req, res) => {
	db.toggleEmployeeWorkingUID(req.body.uid, () => {
		res.end();
	});
});

// User authentication
app.post("/authenticate", (req, res) => {
	const cookies = new Cookies(req.headers.cookie);
	console.log(cookies.get('myCat'));
});