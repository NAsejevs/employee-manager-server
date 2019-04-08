const sqlite3 = require("sqlite3").verbose();
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
			callback(row);
		}
	});
}

module.exports.getEmployeeUID = (uid, callback) => {
	db.get(`SELECT * FROM employees WHERE uid="${uid}"`, (err, row) => {
		if (err) {
			console.log(err);
		} else {
			callback(row);
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

module.exports.getEmployeeWorkLog = (id, callback) => {
	db.all(`SELECT * FROM work_log WHERE employee_id=${id}`, (err, rows) => {
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
		personalCode
	) VALUES (
		"${employee.name}", 
		"${employee.surname}",
		"${employee.personalCode}"
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
	console.log(employee);

	const query = `UPDATE employees 
	SET 
		name = "${employee.name}",
		surname = "${employee.surname}",
		personalCode = "${employee.personalCode}"
	WHERE 
		id = ${employee.id}`;

		console.log(query);

	db.run(query, (err) => {
		if (err) {
			console.log(err);
		} else {
			callback();
		}
	});
}

module.exports.toggleEmployeeWorkingUID = (uid, callback) => {
	exports.getEmployeeUID(uid, (row) => {
		if(row) {
			// Employee was found by UID and the work state has been toggled
			exports.setEmployeeWorking(row.id, !row.working, () => {
				callback();
			});
		} else {
			// No employee with this UID was found, therefore, this is a registration process
			exports.setEmptyUID(uid, () => {
				callback();
			});
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