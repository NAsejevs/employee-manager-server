const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const app = express();
const Cookies = require("universal-cookie");
const db = require("./database");
const fs = require("fs");
const Excel = require("exceljs");
var path = require('path');
var mime = require('mime');

const { 
	daysInMonth, 
	millisecondConverter, 
	isWeekend,
	isNumeric
} = require("./utils");

var whitelist = [
	"http://0.0.0.0:3000",
	"http://0.0.0.0",
	"http://localhost:3000",
	"http://localhost",
	"http://192.168.1.150",
];

const corsOptions = {
	credentials: true,
	origin: function(origin, callback){
        var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
        callback(null, originIsWhitelisted);
    },
	optionsSuccessStatus: 200
};

// Middleware
app.use(
	cors(corsOptions), // User CORS to restric connections from anywhere other than localhost
	compression(),
	bodyParser.json() // Parse JSON requests
);

app.use((req, res, next) => {
	if(req.url !== "/checkSession" &&
	req.url !== "/authenticate" &&
	req.url !== "/cardScanned") {
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

// Send the work log of an employee by id
app.post("/getEmployeeWorkLog", (req, res) => {
	db.getEmployeeWorkLog(req.body.id, (workLog) => {
		res.send(workLog);
		res.end();
	});
});

// Send the work log of an employee by id
app.post("/getEmployeeLastWorkLog", (req, res) => {
	db.getEmployeeLastWorkLog(req.body.id, (workLog) => {
		res.send(workLog);
		res.end();
	});
});

// Send the work log of an employee by id from date to date
app.post("/getEmployeeWorkLogFromTo", (req, res) => {
	db.getEmployeeWorkLogFromTo(req.body.id, req.body.from, req.body.to, (workLog) => {
		res.send(workLog);
		res.end();
	});
});

// Toggle the employee's working state
app.post("/setEmployeeWorking", (req, res) => {
	db.setEmployeeWorking(req.body.id, req.body.working, () => {
		res.end();
	});
});

// Set the employee's archive state
app.post("/setArchivedEmployee", (req, res) => {
	db.setEmployeeArchived(req.body.id, req.body.archived, () => {
		res.end();
	});
});

// Set the employee's active state
app.post("/setActiveEmployee", (req, res) => {
	db.setEmployeeActive(req.body.id, req.body.active, () => {
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

// Export employees to an Excel sheet
app.get("/export", (req, res) => {
	const startDate = new Date();
	startDate.setUTCDate(1);
	const endDate = new Date();
	endDate.setUTCDate(30);

	let workbook = new Excel.Workbook();
	workbook.creator = 'Vārpas 1';
	workbook.created = new Date();
	workbook.modified = new Date();

	workbook.views = [
		{
			x: 0, 
			y: 0, 
			width: 1000, 
			height: 2000,
			visibility: 'visible'
		}
	]

	let worksheet = workbook.addWorksheet("Vārpas 1");

	// Set initial columns
	const columns = [
		{ header: '', key: 'employee', width: 15 }
	];

	// Add all days of the mont as columns
	for(let i = 1; i <= daysInMonth(startDate.getMonth(), startDate.getFullYear()); i++) {
		columns.push(
			{ header: i.toString(), key: i.toString(), width: 5 }
		);
	}

	worksheet.columns = [
		...columns,
		{ header: 'Kopā', key: 'total', width: 10 },
		{ header: 'Dienas', key: 'days', width: 10 }
	];

	// Set column auto filters
	worksheet.autoFilter = {
		from: {
			row: 1,
			column: 1
		},
		to: {
			row: 1,
			column: daysInMonth(startDate.getMonth(), startDate.getFullYear()) + 3
		}
	}

	let weekendDays = [];

	db.getEmployees((employees) => {
		employees.forEach((employee, index) => {
			db.getEmployeeWorkLogFromTo(employee.id, startDate, endDate, (workLog) => {

				let row = {
					employee: employee.name + " " + employee.surname
				}

				// Input all needed data
				let totalWorkTime = 0;
				for(let i = 1; i <= daysInMonth(startDate.getMonth(), startDate.getFullYear()); i++) {
					let totalDayWorkTime = 0;

					row[i.toString()] = 0;

					workLog.forEach((log) => {
						if(!log.end_time) {
							// do not calculate time of this day since the employee hasn't clocked out yet
							return;
						}
						if(new Date(log.start_time).getDate() === i) {
							totalDayWorkTime += new Date(log.end_time) - new Date(log.start_time);
							const workTime = millisecondConverter(totalDayWorkTime);
							const workTimeFormatted = workTime.hours.toFixed(2);

							row[i.toString()] = workTimeFormatted;
						}
					});
					totalWorkTime += totalDayWorkTime;

					const date = new Date(startDate);
					date.setUTCDate(i - 1);
					if(isWeekend(date)) {
						weekendDays.push([i]);
					}
				}

				const totalWorkTimeFormatted = millisecondConverter(totalWorkTime);
				row["total"] = totalWorkTimeFormatted.hours;
				row["days"] = totalWorkTimeFormatted.hours / 8;

				worksheet.addRow(row);

				// Color in all weekend columns
				weekendDays.forEach((weekendDay) => {
					worksheet.getColumnKey(weekendDay.toString()).eachCell({ includeEmpty: true }, (cell, colNumber) => {
						cell.fill = {
							type: "pattern",
							pattern: "solid",
							fgColor:{ argb: "ffcc99" },
							bgColor:{ argb: "ffcc99" }
						}
					});
				});
				
				if(employees.length - 1 === index) {
					fs.unlink("Varpas 1.xlsx", () => {
						workbook.xlsx.writeFile("Varpas 1.xlsx")
						.then(function() {
							res.download("Varpas 1.xlsx", (e) => {
								console.log(e);
								res.end();
							});
						});
					});
				}
			});
		});
	});
});

// ----------------------- Users -----------------------

let sessions = [];

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

	res.send(authenticated);
	res.end();
});

// Authenticate using username and password
app.post("/authenticate", (req, res) => {
	const username = req.body.username;
	const password = req.body.password;
	const rememberMe = req.body.rememberMe;

	const day = 86400000; // in ms
	const week = 604800000; // in ms

	db.getUserByUsername(username, (user) => {
		if(user) {
			if(user.password == password) {
				const key = keyGen(16);

				// Generate new session key for the user
				res.cookie("key", key, { expires: new Date(Date.now() + (rememberMe ? week : day)), httpOnly: true });
				res.cookie("settings", { username: username }, { expires: new Date(Date.now() + (rememberMe ? week : day)) });
				sessions.push({ id: user.id, username: username, key: key });

				res.send(true);
			}
		} else {
			res.send(false);
		}
		res.end();
	});
});

// Log user out and close open session
app.post("/logOut", (req, res) => {
	const cookies = new Cookies(req.headers.cookie);

	res.cookie("key", "", { expires: new Date(Date.now()), httpOnly: true });
	res.end();

	sessions = sessions.filter(session => {
		if(session.key === cookies.get("key")) {
			return false;
		} else {
			return true;
		}
	});
});

app.post("/getUserByUsername", (req, res) => {
	const username = req.body.username;

	db.getUserByUsername(username, (user) => {
		if(user) {
			res.send(user);
		}
		res.end();
	});
});

app.post("/getUserByKey", (req, res) => {
	const cookies = new Cookies(req.headers.cookie);

	let result = false;
	sessions.forEach(session => {
		if(session.key === cookies.get("key")) {
			db.getUserByUsername(session.username, (user) => {
				if(user) {
					result = true;
					res.send(user);
					res.end();
				}
			});
		}
	});

	if(!result) {
		//res.end();
	}
});