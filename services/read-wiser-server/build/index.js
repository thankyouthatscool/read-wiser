import { watch } from "chokidar";
import { config } from "dotenv";
import { parse } from "node:path";
import { parseKindleClippings } from "./utils/parseKindleClippings.js";
import { updateDatabase } from "./utils/updateDatabase.js";
import { updateNotion } from "./utils/updateNotion.js";
config();
const CLIP_CONTAINER_PATH = process.env["CLIP_CONTAINER_PATH"];
const watcher = watch(CLIP_CONTAINER_PATH);
watcher.on("all", async (event, path) => {
    const parsedPath = parse(path);
    const { ext, name } = parsedPath;
    if (event === "add" && ext === ".txt" && name === "My Clippings") {
        const formattedClippings = parseKindleClippings(path);
        const newClippings = await updateDatabase(formattedClippings);
        await updateNotion(newClippings);
    }
});
(async () => { })();
