const resultElement = document.getElementById("result");
const dateFormatInput = document.getElementById("dateformat");

// FIXME: timezone & quarter
const getterFunctions = {
	"d": date => date.toLocaleString("en", { day: "numeric" }),
	"dd": date => date.toLocaleString("en", { day: "2-digit" }),


	"ddd": date => date.toLocaleString("en", { day: "numeric" }) + {
		one: "st",
		two: "nd",
		few: "rd",
		other: "th"
	}[new Intl.PluralRules("en", { type: "ordinal" }).select(date.toLocaleString("en", { day: "numeric" }))],

	// FIXME: this one doesn't work
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
	
	"E": date => date.toLocaleString("en", { weekday: "short" }),
	"EEEE": date => date.toLocaleString("en", { weekday: "long" }),
	"EEE": date => date.toLocaleString("en", { weekday: "long" }),
	"EE": date => date.toLocaleString("en", { weekday: "long" }),
	"EEEEE": date => date.toLocaleString("en", { weekday: "narrow" }),
	"EEEEEE": date => date.toLocaleString("en", { weekday: "long" }).slice(0, 2),

	"y": date => date.getFullYear(),
	"yy": date => date.toLocaleString("en", { year: "2-digit" }),
	"yyyy": date => date.toLocaleString("en", { year: "numeric" }).padStart(4, "0"),

	"M": date => date.toLocaleString("en", { month: "numeric" }),
	"MM": date => date.toLocaleString("en", { month: "2-digit" }),
	"MMM": date => date.toLocaleString("en", { month: "short" }),
	"MMMM": date => date.toLocaleString("en", { month: "long" }),
	"MMMMM": date => date.toLocaleString("en", { month: "narrow" }),

	"h": date => date.toLocaleString("en", { hour12: true, hour: "numeric" }).slice(0, -3),
	"hh": date => date.toLocaleString("en", { hour12: true, hour: "2-digit" }).slice(0, -3),

	"H": date => date.toLocaleString("en", { hour12: false, hour: "numeric" }),
	"HH": date => date.toLocaleString("en", { hour12: false, hour: "2-digit" }),

	"a": date => date.getHours() < 12 ? "AM" : "PM",

	"m": date => date.getMinutes(),
	"mm": date => date.getMinutes().toString().padStart(2, "0"),

	"s": date => date.getSeconds(),
	"ss": date => date.getSeconds().toString().padStart(2, "0"),
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
			if (!next) break;
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

	return [
		`// Formats a date in the format: ${strings.map(s => s.data).join("")}`,
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
	fontSize: "1rem",
	fontFamily: "JetBrains Mono, Inconsolata, Fira Code, monospace",
	readOnly: true,
	useWorker: false,
	showPrintMargin: false
});

editor.renderer.setScrollMargin(5);

const update = () => {
	const format = dateFormatInput.value;
	const date = new Date();
	resultElement.textContent = formatDate(date, format);
	editor.setValue(generateCode(format), 1);
};

dateFormatInput.addEventListener("input", update);
update(); // Initial update