import { Client } from "@notionhq/client";
import { prisma } from "./database.js";
export const updateNotion = async (newClippings) => {
    const NOTION_API_KEY = process.env["NOTION_API_KEY"];
    const notionClient = new Client({ auth: NOTION_API_KEY });
    const { results } = await notionClient.search({ query: "Books" });
    const { id: booksDatabaseId } = results.filter((result) => result.object === "database")[0];
    const normalizedClippings = newClippings.reduce((acc, val) => {
        const { source, ...rest } = val;
        if (acc[val.source]) {
            return { ...acc, [val.source]: [...acc[val.source], rest] };
        }
        else {
            return { ...acc, [val.source]: [rest] };
        }
    }, {});
    const mainUser = await prisma.user.findFirst({});
    const existingUserBooks = await prisma.userNotionPage.findMany({
        where: { userId: mainUser.id },
    });
    const existingSourceList = existingUserBooks.map((source) => source.title);
    const notionPagesToAdd = Object.keys(normalizedClippings).filter((key) => !existingSourceList.includes(key));
    await Promise.all(notionPagesToAdd.map(async (page) => {
        const { author, title } = page.match(/(?<title>.+)\((?<author>.+)\)$/)
            ?.groups;
        const authorArray = author.split(";");
        try {
            const newPage = await notionClient.pages.create({
                parent: {
                    database_id: booksDatabaseId,
                    type: "database_id",
                },
                properties: {
                    Name: {
                        title: [
                            {
                                text: {
                                    content: title,
                                },
                            },
                        ],
                    },
                    Authors: {
                        multi_select: authorArray.map((author) => {
                            return {
                                name: author,
                            };
                        }),
                    },
                },
            });
            await prisma.userNotionPage.create({
                data: {
                    notionId: newPage.id,
                    title: page,
                    userId: mainUser.id,
                },
            });
        }
        catch (e) {
            console.log(e);
        }
    }));
    const fullyMapped = await Object.keys(normalizedClippings).reduce(async (acc, val) => {
        const notionId = (await prisma.userNotionPage.findFirst({
            where: { title: val },
        })).notionId;
        return { ...(await acc), [notionId]: normalizedClippings[val] };
    }, {});
    const pageKeys = Object.keys(fullyMapped);
    await Promise.all(pageKeys.map(async (key) => {
        const pageContent = fullyMapped[key];
        const childrenArray = pageContent.reduce((acc, { content, date, location, page }) => {
            return [
                ...acc,
                {
                    callout: {
                        color: "green_background",
                        icon: {
                            emoji: "🔖",
                        },
                        rich_text: [
                            {
                                text: {
                                    content: `Added on - ${date}\nPage ${page} | Location ${location}`,
                                },
                            },
                        ],
                    },
                },
                {
                    paragraph: {
                        rich_text: [
                            {
                                text: {
                                    content,
                                },
                            },
                        ],
                    },
                },
            ];
        }, []);
        try {
            await notionClient.blocks.children.append({
                block_id: key,
                //@ts-ignore
                children: childrenArray,
            });
        }
        catch (e) {
            console.log(e);
        }
    }));
    console.log("All added!");
};
