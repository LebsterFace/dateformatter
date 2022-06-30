const resultElement = document.getElementById("result");
const dateFormatInput = document.getElementById("dateformat");

/** @type {Record<string, (date: Date) => string | number>} */
const getterFunctions = {
	d: date => date.getDate(),
	dd: date => date.toLocaleString("en-US", { day: "2-digit" }),
	ddd: date => (n => n + ([, "st", "nd", "rd"][n / 10 % 10 ^ 1 && n % 10] || "th"))(date.getDate()),

	F: date => Math.ceil(date.getDate() / 7),

	E: date => date.toLocaleString("en-US", { weekday: "short" }),
	EEEE: date => date.toLocaleString("en-US", { weekday: "long" }),
	EEEEE: date => date.toLocaleString("en-US", { weekday: "narrow" }),
	EEEEEE: date => date.toLocaleString("en-US", { weekday: "long" }).slice(0, 2),

	y: date => date.getFullYear(),
	yy: date => date.toLocaleString("en-US", { year: "2-digit" }),
	yyyy: date => date.toLocaleString("en-US", { year: "numeric" }).padStart(4, "0"),

	M: date => date.toLocaleString("en-US", { month: "numeric" }),
	MM: date => date.toLocaleString("en-US", { month: "2-digit" }),
	MMM: date => date.toLocaleString("en-US", { month: "short" }),
	MMMM: date => date.toLocaleString("en-US", { month: "long" }),
	MMMMM: date => date.toLocaleString("en-US", { month: "narrow" }),

	h: date => date.toLocaleString("en-US", { hour12: true, hour: "numeric" }).slice(0, -3),
	hh: date => date.toLocaleString("en-US", { hour12: true, hour: "2-digit" }).slice(0, -3),

	H: date => date.getHours(),
	HH: date => date.getHours().toString().padStart(2, "0"),

	a: date => date.getHours() < 12 ? "am" : "pm",
	A: date => date.getHours() < 12 ? "AM" : "PM",

	m: date => date.getMinutes(),
	mm: date => date.getMinutes().toString().padStart(2, "0"),

	s: date => date.getSeconds(),
	ss: date => date.getSeconds().toString().padStart(2, "0"),
	SSS: date => date.getMilliseconds(),
};

const EXAMPLE_DATE = new Date("21 Oct 2015 4:29 PM");

const exampleFormats = Object.entries(getterFunctions)
	.map(/** @returns {[string, number | string]} */ ([key, value]) => [key, value(EXAMPLE_DATE)])

const create = (/** @type {string} */ tagName, object = {}, children = []) => {
	const element = document.createElement(tagName);
	Object.assign(element, object)
	element.append(...children);
	return element;
};

const tbody = document.querySelector("tbody");
for (const [pattern, example] of exampleFormats) {
	tbody.append(create("tr", {}, [
		create("td", { textContent: pattern }),
		create("td", { textContent: example })
	]));
}

getterFunctions.EE = getterFunctions.E;
getterFunctions.EEE = getterFunctions.E;

getterFunctions.yyy = getterFunctions.y;

for (const func of ["d", "dd", "ddd", "E", "EE", "EEE", "EEEE", "EEEEE", "EEEEEE", "y", "yy", "yyy", "yyyy"]) {
	const original = getterFunctions[func.toLowerCase()] ?? getterFunctions[func.toUpperCase()];
	getterFunctions[func.toLowerCase()] = original;
	getterFunctions[func.toUpperCase()] = original;
}

//#region Codegen
const getPartCode = part => {
	const string = getterFunctions[part].toString();

	if (string.startsWith("date => {")) {
		return string
			.replaceAll("\r\n", "\n")
			.slice("date => {".length, -1)
			.split("\n")
			.map(line => line
				.replace(/^\t/, "")
				.replace(/return /, `const ${part} = `))
			.filter(line => line.length > 0)
			.join("\n");
	} else if (string.startsWith("date => ")) {
		// \t for indent
		return `\tconst ${part} = ${string.slice("date => ".length)};`;
	} else {
		throw new Error("Unexpected getter function body");
	}
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

const getPreview = (date, format) => parse(format)
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
					functions.push(getPartCode(part));
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

	const commentFormat = strings.map(s => s.data).join("");

	return [
		"/**",
		" * Formats a date as: `" + commentFormat + "`",
		" * @param {Date} date",
		" * @returns {string}",
		" */",
		"const formatDate = date => {",
		...functions,
		"\treturn `" + returnValue + "`;",
		"};"
	].join("\n");
};

const editor = ace.edit("editor", {
	theme: "ace/theme/dracula",
	mode: "ace/mode/javascript",
	fontSize: "1rem",
	fontFamily: "var(--code-font)",
	readOnly: true,
	useWorker: false,
	showPrintMargin: false
});

editor.renderer.setScrollMargin(5);

const update = () => {
	const format = dateFormatInput.value;
	const date = new Date();
	resultElement.textContent = getPreview(date, format);
	editor.setValue(generateCode(format), 1);
};

dateFormatInput.addEventListener("input", update);
update(); // Initial update
//#endregion