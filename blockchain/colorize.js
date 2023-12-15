/**
 * Find all the group names of a regular expression. This includes both named
 * and unnamed groups. If a group is unnamed, it is represented solely by its
 * index while named groups have both. The 0th group is always included.
 *
 * @param {RegExp} regex
 * @returns {(string | number)[]}
 */
function getRegexGroupNames(regex) {
    const info = new RegExp(`(?:)|${regex.source}`, regex.flags).exec("");
    const groupNames = [];

    for (let i = 0; i < info.length; i++) {
        groupNames.push(i);
    }

    for (const name in info.groups) {
        groupNames.push(name);
    }

    return groupNames;
}

/**
 * Convert a number to a string of lowercase letters a-z by treating it as a
 * base-26 number. The number is truncated to a positive integer before
 * conversion.
 *
 * @param {number} number
 * @returns {string}
 */
function numberToIdent(number) {
    return Array.from((number >>> 0).toString(26))
        .map((d) => String.fromCharCode(parseInt(d, 26) + 97))
        .join("");
}

/**
 * Returns a function that replaces text using a ruleset of regular expressions
 * and their respective replacers. The matching rule is determined by first
 * match. This is useful for when consecutive replacements would interfere with
 * each other.
 *
 * NOTE: All regex patterns must have the same flags.
 *
 * @param {{ pattern: RegExp, replacer: (substring: string, ...args: any[]) => string }[]} rules
 */
export function compileReplacementRules(rules) {
    const flags = rules[0]?.pattern.flags ?? "";

    const compiledRules = [];
    let identIndex = 0;
    let groupIndex = 1;

    for (const { pattern, replacer } of rules) {
        if (!(pattern instanceof RegExp)) {
            throw new TypeError("Expected a RegExp");
        }

        if (pattern.flags !== flags) {
            throw new Error("All patterns must have the same flags");
        }

        const id = numberToIdent(identIndex++);
        const mappings = [];

        // Remap group indices and rename named groups to prevent collisions.
        // NOTE: The 0th group is used to point to the matched subrule.
        let source = pattern.source;
        for (const name of getRegexGroupNames(pattern)) {
            switch (typeof name) {
                case "number": {
                    mappings.push([groupIndex++, name]);
                    break;
                }

                case "string": {
                    const newName = numberToIdent(identIndex++);
                    mappings.push([newName, name]);
                    source = source.replace(
                        new RegExp(`(?<!\\\\)((?:\\\\{2})*)\\(\\?<${name}>`, "g"),
                        `$1(?<${newName}>`
                    );
                    break;
                }
            }
        }

        compiledRules.push({
            id,
            mappings,
            source,
            replacer,
        });
    }

    // Create a single regular expression that matches all the patterns in order.
    // Each subrule gets its own named group, and the 0th group of each subrule points to its index.
    const linkedSource = compiledRules.map(({ id, source }) => `(?<${id}>${source})`).join("|") || "(?:)";
    const linkedPattern = new RegExp(linkedSource, flags);

    /**
     * @param {string} text
     */
    return (text) => {
        return text.replace(linkedPattern, (...args) => {
            const groups = args.pop();
            const index = args.pop();

            const rule = compiledRules.find(({ id }) => groups[id] != null);

            const newArgs = [];
            const newGroups = {};

            for (const [from, to] of rule.mappings) {
                switch (typeof from) {
                    case "number":
                        newArgs[to] = args[from];
                        break;
                    case "string":
                        newGroups[to] = groups[from];
                        break;
                }
            }

            return rule.replacer(...newArgs, index, newGroups);
        });
    };
}

/**
 * @param {RegExp} pattern
 * @param {(substring: string, ...args: any[]) => string} replacer
 */
function makeRule(pattern, replacer) {
    return { pattern, replacer };
}

/**
 * Create an inline element with the given class name and content.
 *
 * @param {string} className
 * @param {...(string | Node)} nodes
 * @returns {HTMLElement}
 */
function inlineStyle(className, ...nodes) {
    const span = document.createElement("span");
    span.className = className;
    span.append(...nodes);

    return span;
}

const styleJSON = compileReplacementRules([
    /* strings */
    makeRule(/"(?:(?:\\{2})+|\\"|[^"])*"/gu, (match) => inlineStyle("json-string", match).outerHTML),
    /* numbers */
    makeRule(
        /(?<!\p{L})(?<sign>-?)(?<number>(?:0|[1-9][0-9]*)(?:\.\d+)?(?:e[+-]?\d+)?)(?![0-9])/gu,
        (_0, _1, _2, _3, { sign, number }) =>
            inlineStyle("json-number", inlineStyle("json-unary-sign", sign), number).outerHTML
    ),
    /* constants */
    makeRule(/(?<!\p{L})(?:true|false|null)(?!\p{L})/gu, (match) => inlineStyle("json-constant", match).outerHTML),
]);

/**
 * @param {string} json
 * @returns {HTMLElement}
 */
export default function createStyledJsonElement(json, options = {}) {
    const { tagName = "div", className = "json" } = options;

    const element = document.createElement(tagName);
    element.className = className;
    element.innerHTML = styleJSON(json);

    return element;
}
