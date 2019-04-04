const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const app = express();
const Cookies = require("universal-cookie");
const db = require("./database");
const bcypt = require("bcrypt");

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

app.use((req, res, next) => {
	if(req.url !== "/checkSession" &&
	req.url !== "/authenticate") {
		const cookies = new Cookies(req.headers.cookie);
		sessions.forEach((session) => {
			if(session.key === cookies.get("key")) {
				next();
			}
		});
	} else {
		next();
	}
});

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

// ----------------------- Employees -----------------------

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

// ----------------------- Users -----------------------

const sessions = [];

const keyGen = (length) => {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
  
	return text;
}

// Check existing key if user has one
app.post("/checkSession", (req, res) => {
	let authenticated = false;
	const cookies = new Cookies(req.headers.cookie);

	sessions.forEach((session) => {
		if(session.key === cookies.get("key")) {
			authenticated = true;
		}
	});

	console.log("user key valid: ", authenticated);
	console.log(sessions);

	res.send(authenticated);
	res.end();
});

// Authenticate using username and password
app.post("/authenticate", (req, res) => {
	const username = req.body.username;
	const password = req.body.password;

	db.getUserByUsername(username, (row) => {
		if(row) {
			if(row.password == password) {
				const key = keyGen(16);

				// Generate new session key for the user
				res.cookie("key", key, { expires: new Date(Date.now() + 604800000), httpOnly: true });
				sessions.push({ key: key });

				res.send(true);
			}
		} else {
			res.send(false);
			console.log("user not found");
		}
		res.end();
	});
});