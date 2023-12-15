import { makeChain, makeBlock, verifyChain } from "./blockchain.js";
import createStyledJsonElement from "./colorize.js";

const log = document.querySelector("samp");
const rail = document.querySelector(".rail");

function print(...args) {
    requestAnimationFrame(() => {
        log.appendChild(createStyledJsonElement(args.join(" "), { tagName: "p" }));
        rail.scrollIntoView({ behavior: "instant", block: "end" });
    });
}

const data = ["Hello", "World", "Foo", "Bar", "Baz"];
const chain = [];

performance.mark("mining_start");
try {
    print("⛏️ Mining...");
    for await (const block of makeChain(data.slice(0, -1), { difficulty: 36 })) {
        chain.push(block);
        print(JSON.stringify(block, null, 4));
        print("⛏️ Mining...");
    }

    chain.push(await makeBlock(data.at(-1), chain.at(-1), { difficulty: 36 }));
    print(JSON.stringify(chain.at(-1), null, 4));
} catch (e) {
    console.error(e);
    print(`⚠️ Mining failed (${e.message ?? "Unknown error"})`);
}
performance.mark("mining_end");

const duration = performance.measure("mining", "mining_start", "mining_end").duration / 1000;
print(`⏱️ ${duration.toFixed(2)}s total`);

if (chain.length > 0) {
    print(`📈 ${(duration / chain.length).toFixed(2)}s per block`);

    print("🔗 Verifying...");
    const valid = await verifyChain(chain);

    print(valid ? "✔️ Chain is valid" : "❌ Chain is invalid");
} else {
    print(`⁉️ No blocks mined`);
}
