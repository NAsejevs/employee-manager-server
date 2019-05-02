const sqlite3 = require("sqlite3").verbose();
const server = require("./server");
let db = null;

// --- SQLite3 cheat sheet ---
// https://github.com/mapbox/node-sqlite3/wiki/API
// db.all : query multiple rows
// db.get : query 0 or 1 row
// db.each : call callback for every row in result
// db.run : create/alter tables or indert/update table data

module.exports.connect = () => {
	db = new sqlite3.Database("database.db", (err) => {
		if (err) {
			console.log("Failed to connect to database: ", err);
		} else {
			console.log("Connected to the database!");
		}
	});
}

// ----------------------- Employees -----------------------

module.exports.getEmployees = (callback) => {
	db.all(`SELECT * FROM employees`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.getEmployee = (id, callback) => {
	db.get(`SELECT * FROM employees WHERE id=${id}`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			console.log(row);
			callback(row);
		}
	});
}

module.exports.getEmployeeByUID = (uid, callback) => {
	db.get(`SELECT * FROM employees WHERE uid="${uid}"`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}

module.exports.setEmployeeUID = (uid, id, callback) => {
	db.run(`UPDATE employees SET uid="${uid}" WHERE id=${id}`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.deleteEmployeeUID = (id, callback) => {
	db.run(`UPDATE employees SET uid=null WHERE id=${id}`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

// Registration process:
// Go through all employees and assign a UID to whoever doesn't have one
module.exports.setEmptyUID = (uid, callback) => {
	db.run(`UPDATE employees SET uid="${uid}" WHERE uid IS NULL or uid=""`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.getEmployeeWorkLog = (id, order, callback) => {
	db.all(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time ${order}`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.getEmployeeLastWorkLog = (id, callback) => {
	db.get(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time DESC`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}

module.exports.getEmployeeWorkLogFromTo = (id, from, to, callback) => {
	const fromJSON = new Date(from).toJSON();
	const toJSON = new Date(to).toJSON();

	db.all(`SELECT * FROM work_log WHERE employee_id=${id} AND start_time >= "${fromJSON}" AND start_time <= "${toJSON}"`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.addEmployee = (employee, callback) => {
	const query = `INSERT INTO employees (
		name, 
		surname,
		position,
		number,
		personalCode,
		working
	) VALUES (
		"${employee.name}", 
		"${employee.surname}",
		"${employee.position}",
		"${employee.number}",
		"${employee.personalCode}",
		0
	)`;

	db.run(query, function(err) {
		if (err) {
			console.log(err);
		} else {
			// Get the last inserted row ID in employees table and launch callback with the new employee
			exports.getEmployee(this.lastID, (row) => {
				callback(row);
			});
		}
	});
}

module.exports.setEmployeeWorking = (id, working, callback) => {
	const date = new Date();
	const jsonDate = date.toJSON();
	let query = "";
	let lastWork = "";

	// Log the start and end time of each entry/exit of employee
	if(working) {
		query = `INSERT INTO work_log (
			employee_id, 
			start_time
		) VALUES (
			"${id}", 
			"${jsonDate}"
		)`;

		db.run(query, (err) => {
			if (err) {
				console.log(err);
			}
		});

		lastWork = `last_work_start="${jsonDate}"`;
	} else {
		query = `UPDATE work_log SET 
			end_time = "${jsonDate}" 
			WHERE employee_id = ${id}
			AND (end_time IS null OR end_time = "")`;

		db.run(query, (err) => {
			if (err) {
				console.log(err);
			}
		});

		lastWork = `last_work_end="${jsonDate}"`;
	}

	query = `UPDATE employees SET 
		working = ${working ? 1 : 0},
		${lastWork}
		WHERE id = ${id}`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.setEmployeeArchived = (id, archive, callback) => {
	const query = `UPDATE employees SET 
		archived = ${archive ? 1 : 0}
		WHERE id = ${id}`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.setEmployeeActive = (id, active, callback) => {
	const query = `UPDATE employees SET 
		active = ${active ? 1 : 0}
		WHERE id = ${id}`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.deleteEmployee = (id, callback) => {
	let query = `DELETE FROM employees 
		WHERE
		id = ${id}
	`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			query = `DELETE FROM work_log 
				WHERE
				employee_id = ${id}
			`;

			db.run(query, (err) => {
				if (err) {
					console.log(err);
				} else {
					callback();
				}
			});
		}
	});
}

module.exports.editEmployee = (employee, callback) => {
	const query = `UPDATE employees 
	SET 
		name = "${employee.name}",
		surname = "${employee.surname}",
		personalCode = "${employee.personalCode}",
		position = "${employee.position}",
		number = "${employee.number}"
	WHERE 
		id = ${employee.id}`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

const CARD_SCAN_STATUS = {
	NO_EMPLOYEE: 0,
	BEFORE_DELAY: 1,
	SUCCESS: 2
}

module.exports.toggleEmployeeWorkingUID = (uid, callback) => {
	exports.getEmployeeByUID(uid, (employee) => {
		if(employee) {
			// Prevent double-scan/misscan
			exports.getEmployeeLastWorkLog(employee.id, (workLog) => {
				const currentTime = new Date();
				if(workLog.end_time === null) {
					// Employee clocking out, so check start_time
					const startTime = new Date(workLog.start_time);
					if(currentTime - startTime < server.scanDelay) {
						callback(CARD_SCAN_STATUS.BEFORE_DELAY);
						return;
					}
				} else {
					// Employee clocking in, so check end_time
					const endTime = new Date(workLog.end_time);
					if(currentTime - endTime < server.scanDelay) {
						callback(CARD_SCAN_STATUS.BEFORE_DELAY);
						return;
					}
				}

				// Employee was found by UID and the work state has been toggled
				exports.setEmployeeWorking(employee.id, !employee.working, () => {
					callback(CARD_SCAN_STATUS.SUCCESS);
				});
			});
		} else {
			// No employee with this UID was found
			callback(CARD_SCAN_STATUS.NO_EMPLOYEE);
		}
	});
}

// ----------------------- Users -----------------------

module.exports.getUserByUsername = (username, callback) => {
	db.get(`SELECT * FROM users WHERE username="${username}"`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}