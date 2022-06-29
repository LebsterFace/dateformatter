const resultElement = document.getElementById("result");
const dateFormatInput = document.getElementById("dateformat");

let locale = "en-US";

const ordinal = n => n + {
	one: "st",
	two: "nd",
	few: "rd",
	other: "th"
}[new Intl.PluralRules(locale, { type: "ordinal" }).select(n)];

// FIXME: timezone & quarter
const getterFunctions = {
	// d		14			The day of the month. A single d will use 1 for January 1st.
	"d": date => date.toLocaleString(locale, { day: "numeric" }),
	// dd		14			The day of the month. A double d will use 01 for January 1st.
	"dd": date => date.toLocaleString(locale, { day: "2-digit" }),
	"ddd": date => ordinal(date.toLocaleString(locale, { day: "numeric" })),
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
	"E": date => date.toLocaleString(locale, { weekday: "short" }),
	// EEEE		Tuesday		The wide name of the day of the week
	"EEEE": date => date.toLocaleString(locale, { weekday: "long" }),
	// EEEEE	T			The narrow day of week
	"EEEEE": date => date.toLocaleString(locale, { weekday: "narrow" }),
	// EEEEEE	Tu			The short day of week
	"EEEEEE": date => date.toLocaleString(locale, { weekday: "long" }).slice(0, 2),

	// y	2008		Year, no padding
	"y": date => date.getFullYear(),
	// yy	08			Year, two digits (padding with a zero if necessary)
	"yy": date => date.toLocaleString(locale, { year: "2-digit" }),
	// yyyy	2008		Year, minimum of four digits (padding with zeros if necessary)
	"yyyy": date => date.toLocaleString(locale, { year: "numeric" }).padStart(4, "0"),
	"yyy": date => date.toLocaleString(locale, { year: "numeric" }).padStart(4, "0"),

	// M		12			The numeric month of the year. A single M will use "1" for January.
	"M": date => date.toLocaleString(locale, { month: "numeric" }),
	// MM		12			The numeric month of the year. A double M will use "01" for January.
	"MM": date => date.toLocaleString(locale, { month: "2-digit" }),
	// MMM		Dec			The shorthand name of the month
	"MMM": date => date.toLocaleString(locale, { month: "short" }),
	// MMMM		December	Full name of the month
	"MMMM": date => date.toLocaleString(locale, { month: "long" }),
	// MMMMM	D			Narrow name of the month
	"MMMMM": date => date.toLocaleString(locale, { month: "narrow" }),

	// h		4		The 12-hour hour.
	"h": date => date.toLocaleString(locale, { hour12: true, hour: "numeric" }).slice(0, -3),
	// hh		04		The 12-hour hour padding with a zero if there is only 1 digit
	"hh": date => date.toLocaleString(locale, { hour12: true, hour: "2-digit" }).slice(0, -3),
	// H		16		The 24-hour hour.
	"H": date => date.toLocaleString(locale, { hour12: false, hour: "numeric" }),
	// HH		16		The 24-hour hour padding with a zero if there is only 1 digit.
	"HH": date => date.toLocaleString(locale, { hour12: false, hour: "2-digit" }),
	// a		PM		AM / PM for 12-hour time formats
	"a": date => date.getHours() < 12 ? "AM" : "PM",

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
const functionRegexp = new RegExp("(" + orderedFunctions.join("|") + ")", "g");

const parse = input => {
	const result = [{ data: "" }];
	const characters = [...input];

	for (let i = 0; i < characters.length; i++) {
		const character = characters[i];
		if (character === "\\") {
			const next = characters[++i];
			if (!next) {
				// Special case
				result.at(-1).data += "\\";
				break;
			}

			result.push({ data: next, escaped: true });
		} else if (result.at(-1).escaped) {
			result.push({ data: character });
		} else {
			result.at(-1).data += character;
		}
	}

	return result;
};

const formatDate = (date, format) => parse(format)
	.map(({ data, escaped }) =>
		escaped ? data : data.replace(functionRegexp, func => getterFunctions[func](date))
	).join("");

const generateCode = (format) => {
	const parts = parse(format)
		.map(o => o.escaped ? o : { data: o.data.split(functionRegexp) });

	const functions = [];
	const strings = [];

	const pushLiteral = data => {
		const last = strings.at(-1);
		if (last?.literal) {
			last.data += data;
		} else {
			strings.push({ data, literal: true });
		}
	};

	for (const { data, escaped } of parts) {
		if (escaped) {
			pushLiteral(data);
			continue;
		}

		for (const part of data) {
			if (part in getterFunctions) {
				const alreadyDeclared = strings.some(s => !s.literal && s.data === part);
				if (!alreadyDeclared) {
					// \t for indent
					functions.push(`\tconst ${part} = ${getterFunctions[part].toString().slice("date => ".length)};`);
				}

				strings.push({ data: part, literal: false });
			} else {
				pushLiteral(part);
			}
		}
	}

	const returnValue = strings
		.map(({ literal, data }) => literal ? data : ("${" + data + "}"))
		.join("")
		.replaceAll("\\", "\\\\")
		.replaceAll("`", "\\`");

	const commentValue = strings
		.map(({ literal, data }) => literal ? data : `{${data}}`)
		.join("")
		.replaceAll("\\", "\\\\")
		.replaceAll("`", "\\`");

	return [
		`// Formats a date in the format: ${commentValue}`,
		"const formatDate = date => {",
			...functions,
			'\treturn `' + returnValue + '`;',
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
	editor.setValue(generateCode(format), 1);
});