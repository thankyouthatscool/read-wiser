import { Prisma } from "@prisma/client";

import { prisma } from "./database.js";

export const updateDatabase = async (
  clippings: {
    content: string;
    date: string;
    location: string;
    page: string;
    source: string;
    type: string;
  }[]
) => {
  const books = clippings.map((clipping) => {
    const { author, title } = clipping.source.match(
      /(?<title>.+)\((?<author>.+)\)$/
    )?.groups!;

    return { author, title };
  });

  const sourceSet = books.reduce((acc, val) => {
    const targetBook = acc.find(
      (book) => book.author === val.author || book.title === val.title
    );

    if (!targetBook) {
      return [...acc, { author: val.author, title: val.title.trim() }];
    }

    return acc;
  }, [] as { author: string; title: string }[]);

  const fetchedClippings = await Promise.all(
    clippings.map(async (clipping) => {
      const res = await prisma.clipping.findFirst({
        where: { content: clipping.content },
      });

      return { ...clipping, newClipping: !res };
    })
  );

  const newClippings = fetchedClippings.filter(
    (clipping) => clipping.newClipping
  );

  try {
    await prisma.source.createMany({
      data: sourceSet.map((source) => {
        return { author: source.author, title: source.title };
      }),
      skipDuplicates: true,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code !== "P2002") {
        console.log(e);
        console.log("Looks like its something bad...");
      }
    } else {
      console.log(e);
      console.log("Something went wrong, please try again later.");
    }
  }

  const betterFormattedClippings = newClippings.map((clipping) => {
    const { author, title } = clipping.source.match(
      /(?<title>.+)\((?<author>.+)\)$/
    )?.groups!;

    const { source, ...rest } = clipping;

    return { ...rest, author, title: title.trim() };
  });

  const mainUser = await prisma.user.findFirst();

  if (!mainUser) {
    await prisma.user.create({ data: {} });
  }

  await Promise.all(
    betterFormattedClippings.map(async (clipping) => {
      try {
        const targetSource = await prisma.source.findFirst({
          where: { author: clipping.author, title: clipping.title },
        });

        await prisma.clipping.create({
          data: {
            content: clipping.content,
            location: clipping.location,
            page: clipping.page,
            type: clipping.type,
            sourceId: targetSource!.id,
            userId: mainUser!.id,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code !== "P2002") {
            console.log(e);
            console.log("Looks like its something bad...");
          }
        } else {
          console.log(e);
          console.log("Something went wrong, please try again later.");
        }
      }
    })
  );
};
