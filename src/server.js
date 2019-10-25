const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const compression = require("compression");
const app = express();
const Cookies = require("universal-cookie");
const db = require("./database");
const fs = require("fs");
const Excel = require("exceljs");
const axios = require("axios");
const cluster = require('cluster');

if (cluster.isMaster) {
	cluster.fork();
  
    cluster.on('online', function(worker) {
        console.log('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        console.log('Starting a new worker');
        cluster.fork();
    });
}

if (cluster.isWorker) {
	const { 
		daysInMonth, 
		millisecondConverter, 
		isWeekend
	} = require("./utils");
	
	var whitelist = [
		"http://localhost:8081",
		"http://localhost:5000",
		"http://localhost",
		"http://192.168.1.150:8081",
		"http://192.168.1.150",
		"http://192.168.1.151:8081",
		"http://192.168.1.151",
	];
	
	const corsOptions = {
		credentials: true,
		origin: (origin, callback) => {
			const originIsWhitelisted = whitelist.indexOf(origin) !== -1;
			callback(null, originIsWhitelisted);
		},
		optionsSuccessStatus: 200,
	};
	
	module.exports.scanDelay = 5000;
	
	app.use(bodyParser.json({limit: '50mb'}));
	app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
	
	// Middleware
	app.use(
		cors(corsOptions), // User CORS to restric connections from anywhere other than localhost
		compression(),
	);
	
	app.use((req, res, next) => {
		if(req.url !== "/checkSession"
		&& req.url !== "/authenticate"
		&& req.url !== "/cardScanned"
		&& req.url !== "/ping") {
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
	
	let scannerConnected = false;
	
	// Server is on and is ready to listen and respond!
	server.on("listening", () => {
		// Initialize database.
		db.connect();
	
		// Ping the scanner to make sure it is running and can be connected to
		const scannerURL = "http://localhost:8081";
	
		const request = axios.create({
			baseURL: scannerURL,
			withCredentials: true
		});
	
		setInterval(() => {
			request.post("/ping").then((res) => {
				scannerConnected = res.data;
			}).catch(() => {
				scannerConnected = false;
			});
		}, 1000);
	
		// Loop every 1 minute
		setInterval(() => {
			db.getComments().then((comments) => {
				comments.forEach((comment) => {
					if(new Date() > new Date(comment.expires) && comment.expires !== null) {
						db.deleteEmployeeComment(comment.id);
					}
				});
			});
		}, 60000);

		// Loop every 45 seconds to guarantee a cycle each minute
		setInterval(() => {
			db.getEmployees().then(employees => {
				const currentDate = new Date();
				const day = currentDate.getDate() - 1;

				db.getSchedules(currentDate.getMonth()).then(schedules => {
					schedules.forEach((schedule) => {
						let employee = employees.find((employee) => {
							return employee.id === schedule.employee_id;
						});
						if(employee !== undefined) {
							if(!employee.working) {
								const days = JSON.parse(schedule.days);
							
								switch(days[day]) {
									case "D": {
										if(currentDate.getHours() === 8 && currentDate.getMinutes() === 0) {
											db.addNotification("EMPLOYEE_LATE", {...employee});
										}
										break;
									}
									case "N": {
										if(currentDate.getHours() === 17 && currentDate.getMinutes() === 0) {
											db.addNotification("EMPLOYEE_LATE", {...employee});
										}
										break;
									}
									default: {
										break;
									}
								}
							}
						}
					});
				});
			});
		}, 45000);
	});
	
	// ----------------------- Misc -----------------------
	
	app.post("/ping", (req, res) => {
		res.send({
			server: true,
			scanner: scannerConnected,
		});
		res.end();
	});
	
	// ----------------------- Employees -----------------------
	
	// Add a new employee to the database
	app.post("/addEmployee", (req, res) => {
		db.addEmployee(req.body.employee).then((employee) => {
			res.send(employee);
			res.end();
		});
	});
	
	// Send the client the full list of employees.
	app.post("/getEmployees", (req, res) => {
		db.getEmployees().then((employees) => {
			let allEmployees = employees.map((employee) => {
				return new Promise((resolve, reject) => {
					Promise.all([
						db.getEmployeeWorkLog(employee.id, "ASC"),
						db.getEmployeeComments(employee.id),
						db.getEmployeeSchedules(employee.id, new Date().getMonth())
					]).then((data) => {
						resolve({
							...employee,
							workLog: data[0],
							comments: data[1],
							schedules: data[2],
						});
					}).catch((err) => {
						reject(err);
					});
				});
			});

			Promise.all(allEmployees).then((data) => {
				res.send(data);
				res.end();
			});
		});
	});
	
	// Send the client a signle employee by ID.
	app.post("/getEmployee", (req, res) => {
		db.getEmployee(req.body.id).then((employee) => {
			Promise.all([
				db.getEmployeeWorkLog(employee.id, "ASC"),
				db.getEmployeeComments(employee.id)
			]).then((data) => {
				res.send({
					...employee,
					workLog: data[0],
					comments: data[1],
				});
				res.end();
			});
		});
	});

	app.post("/getNotifications", (req, res) => {
		db.getNotifications().then((notifications) => {
			res.send(notifications);
			res.end();
		});
	});

	app.post("/addNotification", (req, res) => {
		db.addNotification(req.body.type, req.body.data).then(() => {
			res.end();
		});
	});

	app.post("/updateNotification", (req, res) => {
		db.updateNotification(req.body.id, req.body.type, req.body.data).then(() => {
			res.end();
		});
	});

	app.post("/getSchedules", (req, res) => {
		db.getSchedules(req.body.month).then((schedules) => {
			res.send(schedules);
			res.end();
		});
	});

	app.post("/getEmployeeSchedules", (req, res) => {
		db.getEmployeeSchedules(req.body.id, req.body.month).then((schedules) => {
			res.send(schedules);
			res.end();
		});
	});

	app.post("/saveSchedules", (req, res) => {
		db.saveSchedules(req.body.schedules).then(() => {
			res.end();
		});
	});
	
	// Send the work log of an employee by id
	app.post("/getEmployeeWorkLog", (req, res) => {
		db.getEmployeeWorkLog(req.body.id, req.body.order).then((workLog) => {
			res.send(workLog);
			res.end();
		});
	});
	
	// Send the work log of an employee by id
	app.post("/getEmployeeLastWorkLog", (req, res) => {
		db.getEmployeeLastWorkLog(req.body.id).then((workLog) => {
			res.send(workLog);
			res.end();
		});
	});
	
	// Send the work log of an employee by id from date to date
	app.post("/getEmployeeWorkLogFromTo", (req, res) => {
		db.getEmployeeWorkLogFromTo(req.body.id, req.body.from, req.body.to).then((workLog) => {
			res.send(workLog);
			res.end();
		});
	});
	
	// Delete a work log by ID
	app.post("/deleteWorkLog", (req, res) => {
		db.deleteWorkLog(req.body.id, req.body.working, req.body.employeeId).then(() => {
			res.end();
		});
	});
	
	// Edit a work log by ID
	app.post("/editWorkLog", (req, res) => {
		db.editWorkLog(req.body.id, req.body.startDate, req.body.endDate, req.body.working).then(() => {
			res.end();
		});
	});
	
	// Toggle the employee's working state
	app.post("/setEmployeeWorking", (req, res) => {
		db.setEmployeeWorking(req.body.id, req.body.working).then(() => {
			res.end();
		});
	});
	
	// Set the employee's archive state
	app.post("/setArchivedEmployee", (req, res) => {
		db.setEmployeeArchived(req.body.id, req.body.archived).then(() => {
			res.end();
		});
	});
	
	// Set the employee's active state
	app.post("/setActiveEmployee", (req, res) => {
		db.setEmployeeActive(req.body.id, req.body.active).then(() => {
			res.end();
		});
	});
	
	// Delete the employee from it's ID
	app.post("/deleteEmployee", (req, res) => {
		db.deleteEmployee(req.body.id).then(() => {
			res.end();
		});
	});
	
	// Edit the employee's data
	app.post("/editEmployee", (req, res) => {
		db.editEmployee(req.body.employee).then(() => {
			res.end();
		});
	});
	
	// Add a comment for employee
	app.post("/addEmployeeComment", (req, res) => {
		db.addEmployeeComment(req.body.employee, req.body.comment).then(() => {
			res.end();
		});
	});
	
	// Get single employee's comments
	app.post("/getEmployeeComments", (req, res) => {
		db.getEmployeeComments(req.body.id).then((comments) => {
			res.send(comments);
			res.end();
		});
	});
	
	// Delete employee's comment
	app.post("/deleteEmployeeComment", (req, res) => {
		db.deleteEmployeeComment(req.body.commentId).then(() => {
			res.end();
		});
	});
	
	// Export employees to an Excel sheet
	let exportSettings = null;
	
	app.post("/export", (req, res) => {
		exportSettings = { ...req.body.settings };
		res.end();
	});
	
	app.get("/export", (req, res) => {
		const settings = exportSettings;
	
		const startDate = new Date(settings.month);
		startDate.setDate(1);
		startDate.setHours(0, 0, 0, 0);
		const endDate = new Date(settings.month);
		endDate.setDate(daysInMonth(startDate.getMonth(), startDate.getFullYear()));
		endDate.setHours(23, 59, 59);
	
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
			settings.employees.forEach((employee, index) => {
				db.getEmployeeWorkLogFromTo(employee.id, startDate, endDate).then((workLog) => {
					let row = {
						employee: employee.surname + " " + employee.name
					}
	
					// Input all needed data
					let totalWorkTime = 0;
					let leftOver;
					for(let i = 1; i <= daysInMonth(startDate.getMonth(), startDate.getFullYear()); i++) {
						let totalDayWorkTime = 0;
	
						if(leftOver) {
							totalDayWorkTime = leftOver;
							leftOver = 0;
						}
	
						row[i.toString()] = 0;
	
						workLog.forEach((log) => {
							if(!log.end_time) {
								// do not calculate time of this day since the employee hasn't clocked out yet
								return;
							}
							if(new Date(log.start_time).getDate() === i) {
								totalDayWorkTime += new Date(log.end_time) - new Date(log.start_time);
							}
						});
	
						// Check if employee as worked for more than 24h in a single day
						if(totalDayWorkTime > 86400000) {
							leftOver = totalDayWorkTime - 86400000;
							totalDayWorkTime = 86400000;
						}
	
						const workTime = millisecondConverter(totalDayWorkTime);
	
						const workTimeFormatted = workTime.hours.toFixed(2);
						row[i.toString()] = parseFloat(workTimeFormatted);
	
						totalWorkTime += totalDayWorkTime;
	
						const date = new Date(startDate);
						date.setDate(i - 1);
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
					if(settings.employees.length - 1 === index) {
						fs.unlink("Varpas 1.xlsx", () => {
							workbook.xlsx.writeFile("Varpas 1.xlsx")
							.then(function() {
								res.download("Varpas 1.xlsx", (e) => {
									if(e) {
										console.log(e);
									}
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
	
		db.getUserByUsername(username).then((user) => {
			if(user) {
				if(user.password == password) {
					const key = keyGen(16);
	
					// Generate new session key for the user
					res.cookie("key", key, { expires: new Date(Date.now() + (rememberMe ? week : day)), httpOnly: true });
					//res.cookie("settings", { username: username }, { expires: new Date(Date.now() + (rememberMe ? week : day)) });
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
	
		db.getUserByUsername(username).then((user) => {
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
				db.getUserByUsername(session.username).then((user) => {
					if(user) {
						result = true;
						res.send(user);
						res.end();
					}
				});
			}
		});
	});
	
	// ----------------------- Card manipulation -----------------------
	
	let awaitCard = {
		timer: null,
		status: false,
		res: null
	};
	
	app.post("/awaitCard", (req, res) => {
		awaitCard.status = true;
		awaitCard.res = res;
		awaitCard.timer = setTimeout(() => {
			awaitCard.status = false;
			awaitCard.res.send(false);
			awaitCard.res.end();
		}, 120000);
	});
	
	app.post("/cardScanned", (req, res) => {
		if(req.body.admin) {
			console.log("Admin card scan");
			// Administration scanner
			if(awaitCard.status) {
				awaitCard.res.send({ uid: req.body.uid });
				awaitCard.res.end();
				awaitCard.status = false;
				clearTimeout(awaitCard.timer);
				res.end();
			} else {
				db.toggleEmployeeWorkingUID(req.body.uid).then((data) => {
					res.send(data);
					res.end();
				});
			}
		} else {
			// Main employee scanner
			db.toggleEmployeeWorkingUID(req.body.uid).then((data) => {
				res.send(data);
				res.end();
			});
		}
	});
	
	// Client wants to unassign card from employee
	app.post("/getEmployeeByUID", (req, res) => {
		db.getEmployeeByUID(req.body.uid).then((row) => {
			res.send(row);
			res.end();
		});
	});
	
	// Client wants to unassign card from employee
	app.post("/setEmployeeUID", (req, res) => {
		db.setEmployeeUID(req.body.uid, req.body.id).then(() => {
			res.send(true);
			res.end();
		});
	});
	
	// Client wants to unassign card from employee
	app.post("/removeEmployeeUID", (req, res) => {
		db.removeEmployeeUID(req.body.id).then(() => {
			res.send(true);
			res.end();
		});
	});
}
