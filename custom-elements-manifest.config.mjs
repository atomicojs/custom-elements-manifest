import myAwesomePlugin from "./src/plugin.mjs";

export default {
    globs: ["test/atomico.ts"],
    dev: true,
    plugins: [myAwesomePlugin()],
};
