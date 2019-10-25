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

module.exports.getEmployees = () => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM employees`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.getEmployee = (id) => new Promise((resolve, reject) => {
	db.get(`SELECT * FROM employees WHERE id=${id}`, (err, row) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(row);
		}
	});
})

module.exports.getEmployeeByUID = (uid) => new Promise((resolve, reject) => {
	db.get(`SELECT * FROM employees WHERE uid="${uid}"`, (err, row) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(row);
		}
	});
})

module.exports.setEmployeeUID = (uid, id) => new Promise((resolve, reject) => {
	db.run(`UPDATE employees SET uid="${uid}", uid_added="${new Date()}" WHERE id=${id}`, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.removeEmployeeUID = (id) => new Promise((resolve, reject) => {
	db.run(`UPDATE employees SET uid=null, uid_added=null WHERE id=${id}`, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

// Registration process:
// Go through all employees and assign a UID to whoever doesn't have one
module.exports.setEmptyUID = (uid) => new Promise((resolve, reject) => {
	db.run(`UPDATE employees SET uid="${uid}" WHERE uid IS NULL or uid=""`, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.getNotifications = () => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM notifications`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.addNotification = (type, data) => new Promise((resolve, reject) => {
	const dataString = JSON.stringify(data);
	const query = `INSERT INTO notifications (
		type, 
		data,
		date
	) VALUES (
		"${type}", 
		'${dataString}',
		'${new Date().toJSON()}'
	)`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.updateNotification = (id, type, data) => new Promise((resolve, reject) => {
	const dataString = JSON.stringify(data);
	db.run(`UPDATE notifications SET type="${type}", data='${dataString}' WHERE id=${id}`, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.getSchedules = (month) => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM schedules WHERE month=${month}`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.getEmployeeSchedules = (id, month) => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM schedules WHERE month=${month} AND employee_id=${id}`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.saveSchedules = (schedules) => new Promise((resolve, reject) => {
	const promise = new Promise((resolve, reject) => {
		schedules.forEach((schedule, index) => {
			const updateQuery = `UPDATE schedules SET 
				employee_id=?,
				month=?,
				days=?
				WHERE 
				employee_id=${schedule.employee_id}
				AND
				month=${schedule.month}`
	
			const insertQuery = `INSERT INTO schedules (
					employee_id,
					month,
					days
				)  VALUES (
					?,
					?,
					?
				)`;
	
			const params = [
				schedule.employee_id,
				schedule.month,
				JSON.stringify(schedule.days)
			];
	
			db.run(updateQuery, params, function(err) {
				if (err) {
					return reject(err);
				} else {
					if(!this.changes) {
						db.run(insertQuery, params, function(err) {
							if (err) {
								return reject(err);
							} else {
								if (index === schedules.length -1) resolve();
							}
						});
					} else {
						if (index === schedules.length -1) resolve();
					}
				}
			});
		});
	});

	promise.then(() => {
		return resolve();
	})
})

module.exports.getEmployeeWorkLog = (id, order) => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time ${order}`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.getEmployeeLastWorkLog = (id) => new Promise((resolve, reject) => {
	db.get(`SELECT * FROM work_log WHERE employee_id=${id} ORDER BY start_time DESC`, (err, row) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(row);
		}
	});
})

module.exports.getEmployeeWorkLogFromTo = (id, from, to) => new Promise((resolve, reject) => {
	const fromJSON = new Date(from).toJSON();
	const toJSON = new Date(to).toJSON();

	db.all(`SELECT * FROM work_log WHERE employee_id=${id} AND start_time >= "${fromJSON}" AND start_time <= "${toJSON}"`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.deleteWorkLog = (id, working, employeeId) => new Promise((resolve, reject) => {
	let query = `DELETE FROM work_log 
		WHERE
		id = ${id}
	`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			if(working) {
				// A work logs has been deleted while the employee is still working on it, so set the employee to not working
				query = `UPDATE employees SET 
					working = 0
					WHERE id = ${employeeId}`;

				db.run(query, (err) => {
					if (err) {
						return reject(err);
					} else {
						return resolve();
					}
				});

			} else {
				return resolve();
			}
		}
	});
})

module.exports.editWorkLog = (id, startDate, endDate, working) => new Promise((resolve, reject) => {
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
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.addEmployee = (employee) => new Promise((resolve, reject) => {
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
			return reject(err);
		} else {
			// Get the last inserted row ID in employees table and launch callback with the new employee
			exports.getEmployee(this.lastID).then((row) => {
				return resolve(row);
			});
		}
	});
})

module.exports.setEmployeeWorking = (id, working) => new Promise((resolve, reject) => {
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
				return reject(err);
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
				return reject(err);
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
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.setEmployeeArchived = (id, archive) => new Promise((resolve, reject) => {
	const query = `UPDATE employees SET 
		archived = ${archive ? 1 : 0}
		WHERE id = ${id}`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.setEmployeeActive = (id, active) => new Promise((resolve, reject) => {
	const query = `UPDATE employees SET 
		active = ${active ? 1 : 0}
		WHERE id = ${id}`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.deleteEmployee = (id) => new Promise((resolve, reject) => {
	let query = `DELETE FROM employees 
		WHERE
		id = ${id}
	`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			query = `DELETE FROM work_log 
				WHERE
				employee_id = ${id}
			`;

			db.run(query, (err) => {
				if (err) {
					return reject(err);
				} else {
					return resolve();
				}
			});
		}
	});
})

module.exports.editEmployee = (employee) => new Promise((resolve, reject) => {
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
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.addEmployeeComment = (employee, comment) => new Promise((resolve, reject) => {
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
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.getComments = () => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM comments`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.getEmployeeComments = (id) => new Promise((resolve, reject) => {
	db.all(`SELECT * FROM comments WHERE employee=${id}`, (err, rows) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(rows);
		}
	});
})

module.exports.deleteEmployeeComment = (commentId) => new Promise((resolve, reject) => {
	let query = `DELETE FROM comments 
		WHERE
		id = ${commentId}
	`;

	db.run(query, (err) => {
		if (err) {
			return reject(err);
		} else {
			return resolve();
		}
	});
})

module.exports.toggleEmployeeWorkingUID = (uid) => new Promise((resolve, reject) => {
	exports.getEmployeeByUID(uid).then((employee) => {
		if(employee) {
			if(!employee.active) {
				return resolve({status: 0, employee});
			}

			// Prevent double-scan/misscan
			exports.getEmployeeLastWorkLog(employee.id).then((workLog) => {
				if(workLog) {
					const currentTime = new Date();
					if(workLog.end_time === null) {
						// Employee clocking out, so check start_time
						const startTime = new Date(workLog.start_time);
						if(currentTime - startTime < server.scanDelay) {
							return resolve({status: 2, employee});
						}
					} else {
						// Employee clocking in, so check end_time
						const endTime = new Date(workLog.end_time);
						if(currentTime - endTime < server.scanDelay) {
							return resolve({status: 2, employee});
						}
					}
				}
				// Employee was found by UID and the work state has been toggled
				exports.setEmployeeWorking(employee.id, !employee.working);
				return resolve({status: 1, employee});
			});
		} else {
			return resolve({status: 0, employee: null});
		}
	});
})

// ----------------------- Users -----------------------

module.exports.getUserByUsername = (username) => new Promise((resolve, reject) => {
	db.get(`SELECT * FROM users WHERE username="${username}"`, (err, row) => {
		if (err) {
			return reject(err);
		} else {
			return resolve(row);
		}
	});
})
