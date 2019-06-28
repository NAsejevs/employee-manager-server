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

module.exports.getEmployees = (callback = () => null) => {
	db.all(`SELECT * FROM employees`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.getEmployee = (id, callback = () => null) => {
	db.get(`SELECT * FROM employees WHERE id=${id}`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}

module.exports.getEmployeeByUID = (uid, callback = () => null) => {
	db.get(`SELECT * FROM employees WHERE uid="${uid}"`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}

module.exports.setEmployeeUID = (uid, id, callback = () => null) => {
	db.run(`UPDATE employees SET uid="${uid}", uid_added="${new Date()}" WHERE id=${id}`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.removeEmployeeUID = (id, callback = () => null) => {
	db.run(`UPDATE employees SET uid=null, uid_added=null WHERE id=${id}`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

// Registration process:
// Go through all employees and assign a UID to whoever doesn't have one
module.exports.setEmptyUID = (uid, callback = () => null) => {
	db.run(`UPDATE employees SET uid="${uid}" WHERE uid IS NULL or uid=""`, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.getEmployeeWorkLog = (id, order, callback = () => null) => {
	db.all(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time ${order}`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.getEmployeeLastWorkLog = (id, callback = () => null) => {
	db.get(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time DESC`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}

module.exports.getEmployeeWorkLogFromTo = (id, from, to, callback = () => null) => {
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

module.exports.deleteWorkLog = (id, working, employeeId, callback = () => null) => {
	let query = `DELETE FROM work_log 
		WHERE
		id = ${id}
	`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			if(working) {
				// A work logs has been deleted while the employee is still working on it, so set the employee to not working
				query = `UPDATE employees SET 
					working = 0
					WHERE id = ${employeeId}`;

				db.run(query, (err) => {
					if (err) {
						console.log(err);
					} else {
						callback();
					}
				});

			} else {
				callback();
			}
		}
	});
}

module.exports.editWorkLog = (id, startDate, endDate, working, callback = () => null) => {
	let query = `UPDATE work_log SET 
		start_time="${startDate}", 
		end_time="${endDate}" 
	WHERE 
		id=${id}`;

	if(working) {
		query = `UPDATE work_log SET 
		start_time="${startDate}"
	WHERE 
		id=${id}`;
	}

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.addEmployee = (employee, callback = () => null) => {
	const query = db.prepare("INSERT INTO employees (name, surname, company, position, number, personalCode, working, uid) VALUES (?, ?, ?, ?, ?, ?, 0, ?)");

	query.run([
		employee.name,
		employee.surname,
		employee.company,
		employee.position,
		employee.number,
		employee.personalCode,
		employee.uid,
	], function(err) {
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

module.exports.setEmployeeWorking = (id, working, callback = () => null) => {
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

module.exports.setEmployeeArchived = (id, archive, callback = () => null) => {
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

module.exports.setEmployeeActive = (id, active, callback = () => null) => {
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

module.exports.deleteEmployee = (id, callback = () => null) => {
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

module.exports.editEmployee = (employee, callback = () => null) => {
	const query = db.prepare(`UPDATE employees 
		SET 
			name = ?,
			surname = ?,
			personalCode = ?,
			company = ?,
			position = ?,
			number = ?
		WHERE 
			id = ?`);

	query.run([
		employee.name,
		employee.surname,
		employee.personalCode,
		employee.company,
		employee.position,
		employee.number,
		employee.id
	], (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.addEmployeeComment = (employee, comment, callback = () => null) => {
	query = `INSERT INTO comments (
		employee, 
		text,
		expires
	) VALUES (
		${employee.id}, 
		"${comment.text}",
		"${comment.manualDelete ? null : comment.expires}"
	)`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.getComments = (callback = () => null) => {
	db.all(`SELECT * FROM comments`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.getEmployeeComments = (id, callback = () => null) => {
	db.all(`SELECT * FROM comments WHERE employee=${id}`, (err, rows) => {
		if (err) {
			console.log(err);
		} else {
			callback(rows);
		}
	});
}

module.exports.deleteEmployeeComment = (commentId, callback = () => null) => {
	let query = `DELETE FROM comments 
		WHERE
		id = ${commentId}
	`;

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.toggleEmployeeWorkingUID = (uid, callback = () => null) => {
	exports.getEmployeeByUID(uid, (employee) => {
		if(employee) {
			if(!employee.active) {
				callback(0);
				return;
			}

			// Prevent double-scan/misscan
			exports.getEmployeeLastWorkLog(employee.id, (workLog) => {
				if(workLog) {
					const currentTime = new Date();
					if(workLog.end_time === null) {
						// Employee clocking out, so check start_time
						const startTime = new Date(workLog.start_time);
						if(currentTime - startTime < server.scanDelay) {
							callback(2);
							return;
						}
					} else {
						// Employee clocking in, so check end_time
						const endTime = new Date(workLog.end_time);
						if(currentTime - endTime < server.scanDelay) {
							callback(2);
							return;
						}
					}
				}
				// Employee was found by UID and the work state has been toggled
				exports.setEmployeeWorking(employee.id, !employee.working);
				callback(1);
			});
		} else {
			callback(0);
		}
	});
}

// ----------------------- Users -----------------------

module.exports.getUserByUsername = (username, callback = () => null) => {
	db.get(`SELECT * FROM users WHERE username="${username}"`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
		}
	});
}
