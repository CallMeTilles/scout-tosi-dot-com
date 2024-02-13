import NotionCMS, { Head, Linker, Images } from "@agency-kit/notion-cms";
import dotenv from 'dotenv';

dotenv.config();

const notion = new NotionCMS({
  databaseId: process.env.NOTION_DB_ID,
  notionAPIKey: process.env.NOTION_API_KEY,
  localCacheDirectory: `${process.cwd()}/lc/`,
  draftMode: false, // turn off for PROD
  rootAlias: '/about',
  plugins: [
    Head(),
    Linker(),
    Images(),
    {
      name: 'layouts',
      hook: 'during-tree',
      exec: pageContent => {
        let layoutString = pageContent?.otherProps?.Layout?.rich_text[0]?.text?.content || "base"
        layoutString.toLowerCase()
          .replace(/[^\w-]+/g, '')
          .replace(/ +/g, '-');
        Object.assign(pageContent, { Layout: `layouts/${layoutString}.njk` })
        return pageContent
      }
    }],
});

export default async function (config) {
  try {
    await notion.pull();
    notion.export({ pretty: true, path: `${process.cwd()}/lc/debug.json` })
  } catch (e) {
    console.error(e)
  }

  const pageCollection = new Set();
  const navCollection = new Set();

  notion.walk(node => {
    const collectionName = `${node.slug}-${simpleHash(node.id)}`;
    node.collectionName = collectionName;
    pageCollection.add(node);
    const pages = notion.filterSubPages(node.path);
    if (pages.length) {
      navCollection.add(node);
      config.addCollection(collectionName, () => pages);
    }
  });

  config.addCollection('combined', () => Array.from(pageCollection).flatMap(page => page));

  config.addCollection('nav', () => Array.from(navCollection).flatMap(page => page));

  config.addCollection('portfolio', () => notion.filterSubPages('/portfolio'));

  config.addCollection('posts', () => notion.filterSubPages('/posts'));

  config.addNunjucksFilter("removeEleventyProps", function (value) {
    const eleventyProps = [
      "outputPath", "date", "inputPath", "fileSlug", "filePathStem",
      "outputFileExtension", "templateSyntax"
    ];
    let cleanObject = Object.assign({}, value);
    eleventyProps.forEach(prop => { delete cleanObject[prop]; });
    return cleanObject;
  });

  config.addNunjucksGlobal('PROD', process.env.PROD);

  config.addPassthroughCopy({ "public": "/" });

  config.addPassthroughCopy('src/main.css');

  config.addWatchTarget("./src/*.css");

  config.setServerOptions({
    port: 3000
  });

  return {
    templateFormats: ['md', 'njk'],
    dir: {
      input: "src"
    }
  }
}

function simpleHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}
