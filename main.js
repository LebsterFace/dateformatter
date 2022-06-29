const resultElement = document.getElementById("result");
const dateFormatInput = document.getElementById("dateformat");
const codeElement = document.getElementById("code");

const ordinal = n => n + {
	one: "st",
	two: "nd",
	few: "rd",
	other: "th"
}[new Intl.PluralRules("en", { type: "ordinal" }).select(n)];

// FIXME: timezone & quarter
const getterFunctions = {
	// d		14			The day of the month. A single d will use 1 for January 1st.
	"d": date => date.toLocaleString("en-US", { day: "numeric" }),
	// dd		14			The day of the month. A double d will use 01 for January 1st.
	"dd": date => date.toLocaleString("en-US", { day: "2-digit" }),
	"ddd": date => ordinal(date.toLocaleString("en-US", { day: "numeric" })),
	// F		2			(numeric) The day of week in the month.
	"F": orig => {
		const date = new Date(orig.valueOf());
		const day = date.getDay();

		let count = 0;
		while (date.getDate() > 1) {
			if (date.getDay() === day) count++;
			date.setDate(date.getDate() - 1);
		}

		if (date.getDay() === day) count++;
		return count;
	},
	// E		Tue			The abbreviation for the day of the week
	"E": date => date.toLocaleString("en-US", { weekday: "short" }),
	// EEEE		Tuesday		The wide name of the day of the week
	"EEEE": date => date.toLocaleString("en-US", { weekday: "long" }),
	// EEEEE	T			The narrow day of week
	"EEEEE": date => date.toLocaleString("en-US", { weekday: "narrow" }),
	// EEEEEE	Tu			The short day of week
	"EEEEEE": date => "(EEEEEE is not implemented)",

	// y	2008		Year, no padding
	"y": date => date.getFullYear(),
	// yy	08			Year, two digits (padding with a zero if necessary)
	"yy": date => date.toLocaleString("en-US", { year: "2-digit" }),
	// yyyy	2008		Year, minimum of four digits (padding with zeros if necessary)
	"yyyy": date => date.toLocaleString("en-US", { year: "numeric" }).padStart(4, "0"),

	// M		12			The numeric month of the year. A single M will use "1" for January.
	"M": date => date.toLocaleString("en-US", { month: "numeric" }),
	// MM		12			The numeric month of the year. A double M will use "01" for January.
	"MM": date => date.toLocaleString("en-US", { month: "2-digit" }),
	// MMM		Dec			The shorthand name of the month
	"MMM": date => date.toLocaleString("en-US", { month: "short" }),
	// MMMM		December	Full name of the month
	"MMMM": date => date.toLocaleString("en-US", { month: "long" }),
	// MMMMM	D			Narrow name of the month
	"MMMMM": date => date.toLocaleString("en-US", { month: "narrow" }),

	// h		4		The 12-hour hour.
	"h": date => date.toLocaleString("en-US", { hour12: true, hour: "numeric" }).slice(0, -3),
	// hh		04		The 12-hour hour padding with a zero if there is only 1 digit
	"hh": date => date.toLocaleString("en-US", { hour12: true, hour: "2-digit" }).slice(0, -3),
	// H		16		The 24-hour hour.
	"H": date => date.toLocaleString("en-US", { hour12: false, hour: "numeric" }),
	// HH		16		The 24-hour hour padding with a zero if there is only 1 digit.
	"HH": date => date.toLocaleString("en-US", { hour12: false, hour: "2-digit" }),
	// a		PM		AM / PM for 12-hour time formats
	"a": date => date.toLocaleString("en-US", { hour12: true, hour: "2-digit" }).slice(3),

	// m		35		The minute, with no padding for zeroes.
	"m": date => date.getMinutes(),
	// mm		35		The minute with zero padding.
	"mm": date => date.getMinutes().toString().padStart(2, "0"),

	// s		8		The seconds, with no padding for zeroes.
	"s": date => date.getSeconds(),

	// ss		08		The seconds with zero padding.
	"ss": date => date.getSeconds().toString().padStart(2, "0"),

	// SSS		123		The milliseconds.
	"SSS": date => date.getMilliseconds(),
};

const orderedFunctions = Object.keys(getterFunctions).sort((a, b) => b.length - a.length);
const functionRegexp = new RegExp(`\\b(${orderedFunctions.join("|")})\\b|.*`, "g");

const formatDate = (date, format) => format
	.split(/\b/)
	.flatMap(word => word.match(functionRegexp))
	.map(part => part in getterFunctions ? getterFunctions[part](date) : part)
	.join("");

const generateCode = (date, format) => {
	const parts = format.split(/\b/)
		.flatMap(word => word.match(functionRegexp))
		.filter(part => part.length > 0);

	const functions = [];
	const strings = [];

	for (const part of parts) {
		const func = getterFunctions[part];
		if (func) {
			if (!strings.some(e => !e.isLiteral && e.data === part)) {
				functions.push(`const ${part} = ${func.toString().slice("date => ".length)};`);
			}

			strings.push({ data: part, isLiteral: false });
		} else {
			if (strings.at(-1)?.isLiteral) {
				strings.push({ data: strings.pop().data + part, isLiteral: true });
			} else {
				strings.push({ data: part, isLiteral: true });
			}

		}
	};


	return [
		`// Formats a date in the format: ${format}`,
		"const formatDate = date => {",
		...functions.map(f => "\t" + f),
		`\treturn \`${strings.map(({ isLiteral, data }) =>
			isLiteral ? data : ("${" + data + "}")
		).join("")
			.replaceAll("\\", "\\\\")
			.replaceAll("`", "\\`")}\`;`,
		"};"
	].join("\n");
};

ace.config.setModuleUrl("ace/mode/javascript", require("file-loader!./mode-javascript.js"));

const editor = ace.edit("editor", {
	theme: "ace/theme/dracula",
	mode: "ace/mode/javascript",
	fontSize: "18px",
	fontFamily: "JetBrains Mono, Inconsolata, Fira Code, monospace",
	readOnly: true,
	useWorker: false,
	showPrintMargin: false
});

editor.renderer.setScrollMargin(5);

dateFormatInput.addEventListener("input", () => {
	const format = dateFormatInput.value;
	const date = new Date();
	resultElement.textContent = formatDate(date, format);
	editor.setValue(generateCode(date, format), 1);
});