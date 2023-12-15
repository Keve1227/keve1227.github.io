function bufferToString(buf) {
    return new TextDecoder("ISO-8859-1").decode(buf);
}

function countBits(n) {
    let count = 0;
    while (n) {
        n &= n - 1;
        count++;
    }

    return count;
}

async function digestBlock(block) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...block, hash: undefined })));
}

export async function makeBlock(data, parent, options = {}) {
    const { difficulty = 36, signal = AbortSignal.timeout(60000) } = options;
    let done = false;

    const block = await Promise.race(
        [...new Array(6)].map(async () => {
            while (true) {
                const block = {
                    parent: parent?.hash ?? null,
                    timestamp: Date.now(),
                    difficulty,
                    nonce: crypto.getRandomValues(new Uint32Array(1))[0],
                    hash: undefined,
                    data,
                };

                const hash = await digestBlock(block);
                if (done) return;

                if (signal?.aborted) {
                    throw new Error(signal.reason);
                }

                let bitCount = 0;
                for (const n of new Uint8Array(hash)) {
                    bitCount += countBits(n);
                }

                if (bitCount >= 128 + difficulty) {
                    done = true;
                    block.hash = bufferToString(hash);
                    return block;
                }
            }
        })
    );

    if (signal?.aborted) {
        throw new Error(signal.reason);
    }

    return block;
}

export async function verifyBlock(block, parent = null) {
    if (parent) {
        if (block.parent !== parent.hash) {
            return false;
        }

        if (block.timestamp < parent.timestamp) {
            return false;
        }

        if (block.difficulty < parent.difficulty) {
            return false;
        }
    }

    const hash = await digestBlock(block);

    if (block.hash !== bufferToString(hash)) {
        return false;
    }

    let bitCount = 0;
    for (const n of new Uint8Array(hash)) {
        bitCount += countBits(n);
    }

    if (bitCount < 128 + block.difficulty) {
        return false;
    }

    return true;
}

export async function* makeChain(data, options = {}) {
    const { signal } = options;
    let parent = null;

    for (const d of data) {
        const block = await makeBlock(d, parent, options);

        if (signal?.aborted) {
            throw new Error(signal.reason);
        }

        yield (parent = block);
    }
}

export async function verifyChain(chain, options = {}) {
    const { signal = AbortSignal.timeout(60000) } = options;
    let parent = null;

    for (const block of chain) {
        const valid = await verifyBlock(block, parent);

        if (signal?.aborted) {
            throw new Error(signal.reason);
        }

        if (!valid) {
            return false;
        }

        parent = block;
    }

    return true;
}
