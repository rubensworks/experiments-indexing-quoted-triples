import { DataFactory } from "rdf-data-factory";
import {
    RdfStore,
    RdfStoreIndexNestedMapQuoted,
    TermDictionaryNumberRecordFullTerms,
    TermDictionaryQuoted,
    TermDictionaryQuotedIndexed,
    TermDictionaryQuotedReferential
} from "rdf-stores";
import * as assert from 'assert';

const PREFIX = 'http://example.org/#';
const DATASET_SIZES = [
    1_000,
    5_000,
    10_000,
    50_000,
    100_000,
    500_000,
    1_000_000, // Requires 9GB of RAM for quoted-idx
];
const DEPTHS = [
    1,
    2,
    3,
    4,
    5,
];
const COLORS = [
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'white',
    'black',
    'purple',
    'brown',
    'pink',
]
const METHODS = {
    'singular': () => new RdfStore({
        indexCombinations: RdfStore.DEFAULT_INDEX_COMBINATIONS,
        indexConstructor: subOptions => new RdfStoreIndexNestedMapQuoted(subOptions),
        dictionary: new TermDictionaryNumberRecordFullTerms(),
        dataFactory: new DataFactory(),
    }),
    'quoted': () => new RdfStore({
        indexCombinations: RdfStore.DEFAULT_INDEX_COMBINATIONS,
        indexConstructor: subOptions => new RdfStoreIndexNestedMapQuoted(subOptions),
        dictionary: new TermDictionaryQuoted(new TermDictionaryNumberRecordFullTerms(), new TermDictionaryNumberRecordFullTerms()),
        dataFactory: new DataFactory(),
    }),
    'quoted-ref': () => new RdfStore({
        indexCombinations: RdfStore.DEFAULT_INDEX_COMBINATIONS,
        indexConstructor: subOptions => new RdfStoreIndexNestedMapQuoted(subOptions),
        dictionary: new TermDictionaryQuotedReferential(new TermDictionaryNumberRecordFullTerms()),
        dataFactory: new DataFactory(),
    }),
    'quoted-idx': () => new RdfStore({
        indexCombinations: RdfStore.DEFAULT_INDEX_COMBINATIONS,
        indexConstructor: subOptions => new RdfStoreIndexNestedMapQuoted(subOptions),
        dictionary: new TermDictionaryQuotedIndexed(new TermDictionaryNumberRecordFullTerms()),
        dataFactory: new DataFactory(),
    }),
}
const SCALE_DOWN_QUERIES = 100;
const FMT = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

const DF = new DataFactory();

function generateTriples(size, depth) {
    const triples = [];
    for (let i = 0; i < size; i++) {
        const groupId = Math.floor(i / 10);
        const color = COLORS[i % 10];
        let leaf = DF.quad(DF.namedNode(`${PREFIX}Violets`), DF.namedNode(`${PREFIX}haveColor`), DF.literal(`${color}`));
        for (let j = 0; j < depth; j++) {
            leaf = DF.quad(DF.namedNode(`${PREFIX}person${groupId}`), DF.namedNode(`${PREFIX}says`), leaf);
        }
        triples.push(DF.quad(DF.namedNode(`${PREFIX}person${i}`), DF.namedNode(`${PREFIX}says`), leaf));
    }
    return triples;
}

function ingest(store, triples) {
    for (const triple of triples) {
        store.addQuad(triple);
    }
}

function queryExact(store, size, depth) {
    for (let i = 0; i < size / SCALE_DOWN_QUERIES; i++) {
        const groupId = Math.floor(i / 10);
        const color = COLORS[i % 10];
        let leaf = DF.quad(DF.namedNode(`${PREFIX}Violets`), DF.namedNode(`${PREFIX}haveColor`), DF.literal(`${color}`));
        for (let j = 0; j < depth; j++) {
            leaf = DF.quad(DF.namedNode(`${PREFIX}person${groupId}`), DF.namedNode(`${PREFIX}says`), leaf);
        }
        assert.equal(store.getQuads(
            DF.namedNode(`${PREFIX}person${i}`),
            DF.namedNode(`${PREFIX}says`),
            leaf
        ).length, 1);
    }
}

function queryColors(store, size, depth) {
    for (let groupId = 0; groupId < size / 10 / SCALE_DOWN_QUERIES; groupId++) {
        let leaf = DF.quad(DF.namedNode(`${PREFIX}Violets`), DF.namedNode(`${PREFIX}haveColor`), DF.variable('color'));
        for (let j = 0; j < depth; j++) {
            leaf = DF.quad(DF.namedNode(`${PREFIX}person${groupId}`), DF.namedNode(`${PREFIX}says`), leaf);
        }

        assert.equal(store.getQuads(
            DF.variable(`person`),
            DF.namedNode(`${PREFIX}says`),
            leaf
        ).length, 10);
    }
}

function queryPeople(store, size, depth) {
    for (let colorId = 0; colorId < 10; colorId++) {
        const color = COLORS[colorId];
        let leaf = DF.quad(DF.namedNode(`${PREFIX}Violets`), DF.namedNode(`${PREFIX}haveColor`), DF.literal(`${color}`));
        for (let j = 0; j < depth; j++) {
            leaf = DF.quad(DF.variable(`person`), DF.namedNode(`${PREFIX}says`), leaf);
        }

        assert.equal(store.getQuads(
            undefined,
            DF.namedNode(`${PREFIX}says`),
            leaf
        ).length, size / 10);
    }
}

function measure(cb) {
    const start = performance.now();
    cb();
    return performance.now() - start;
}

function getStoreSize(store) {
    let size = 0;
    if (store.dictionary instanceof TermDictionaryQuotedIndexed) {
        size = JSON.stringify(store.dictionary.plainTermDictionary).length +
            JSON.stringify(store.dictionary.quotedTriplesDictionary).length;
        for (const subDict of store.dictionary.quotedTriplesReverseDictionaries) {
            size += JSON.stringify(subDict.nestedMap).length;
        }
    } else {
        size = JSON.stringify(store.dictionary).length;
    }
    for (const indexWrapper of store.indexesWrapped) {
        size += JSON.stringify(indexWrapper.index.nestedMap).length;
    }
    return size;
}

function run() {
    // console.log(`| Size | Depth | Method | Ingestion time | Query (s:high) | Query (s:med) | Query (s:low) | Storage size (MB) |`);
    // console.log(`| ---- | ----- | ------ | -------------- | --------------------- | ------------------- | ------------ |`);
    console.log(`size,depth,Method,ingestion,query-high,query-med,query-low,size`);

    // Warmup
    for (let i = 0; i < 3; i++) {
        const triples = generateTriples(1000, 2);
        for (const method in METHODS) {
            const store = METHODS[method]();
            ingest(store, triples);
            queryExact(store, 1000, 2);
            queryColors(store, 1000, 2);
            queryPeople(store, 1000, 2);
        }
    }


    // Actual execution
    for (const size of DATASET_SIZES) {
        for (const depth of DEPTHS) {
            const triples = generateTriples(size, depth);
            for (const method in METHODS) {
                const store = METHODS[method]();
                const timeIngest = measure(() => ingest(store, triples));
                const timeQueryExact = measure(() => queryExact(store, size, depth));
                const timeQueryColors = measure(() => queryColors(store, size, depth));
                const timeQueryPeople = measure(() => queryPeople(store, size, depth));
                const storeSize = getStoreSize(store);
                // console.log(`| ${size} | ${depth} | ${method} | ${timeIngest.toLocaleString('en-US', FMT)} | ${timeQueryExact.toLocaleString('en-US', FMT)} | ${timeQueryColors.toLocaleString('en-US', FMT)} | ${timeQueryPeople.toLocaleString('en-US', FMT)} | ${(storeSize / 1024 / 1024).toLocaleString('en-US', FMT)} |`);
                console.log(`${size},${depth},${method},${timeIngest.toLocaleString('en-US', FMT)},${timeQueryExact.toLocaleString('en-US', FMT)},${timeQueryColors.toLocaleString('en-US', FMT)},${timeQueryPeople.toLocaleString('en-US', FMT)},${(storeSize / 1024 / 1024).toLocaleString('en-US', FMT)}`);
            }
        }
    }
}
run();
