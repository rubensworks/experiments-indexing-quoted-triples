# Experiments for in-memory indexing of quoted triples

This repository contains the scripts and results for reproducing the experiments of
the ["In-Memory Indexing of Quoted RDF Triples" article](https://github.com/rubensworks/article-quoted-triples-index).

It uses different combinations of indexes provided by the [`rdf-stores` implementation](https://github.com/rubensworks/rdf-stores.js).

To reproduce these results, the following commands can be executed:
```shell
$ git clone https://github.com/rubensworks/experiments-indexing-quoted-triples
$ cd experiments-indexing-quoted-triples
$ npm install
$ node run --max-old-space-size=12000 --expose-gc index.mjs
```

_This requires [Node.js](https://nodejs.org/en) to be installed._

## License
This software is written by [Ruben Taelman](http://rubensworks.net/).

This code is released under the [MIT license](http://opensource.org/licenses/MIT).
