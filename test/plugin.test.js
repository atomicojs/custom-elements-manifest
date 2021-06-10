import test from "ava";
import { readFile } from "fs/promises";

test("expect", async (t) => {
    const opt1 = JSON.parse(
        await readFile(new URL("./expect.json", import.meta.url))
    );
    const opt2 = JSON.parse(
        await readFile(new URL("../custom-elements.json", import.meta.url))
    );

    t.deepEqual(opt1, opt2);
});
