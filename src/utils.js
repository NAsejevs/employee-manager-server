module.exports.daysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
}

module.exports.addZero = (i) => {
	if (i < 10) {
		i = "0" + i;
	}
	return i;
}

module.exports.millisecondConverter = (ms) => {
	let seconds = Math.floor(ms/1000);
	let minutes = Math.floor(seconds/60);
	let hours = Math.floor(minutes/60);

	minutes = minutes-(hours*60);
	seconds = seconds-(hours*60*60)-(minutes*60);

	return {
		seconds,
		minutes,
		hours
	}
}

module.exports.isWeekend = (date) => {
	const day = date.getDay();
	return ((day === 5) || (day === 6));
}

module.exports.isNumeric = (n) => {
	return !isNaN(parseFloat(n)) && isFinite(n);
}