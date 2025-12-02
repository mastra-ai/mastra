import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';

function legacy(parser) {
    return new LanguageSupport(StreamLanguage.define(parser));
}
function sql(dialectName) {
    return import('@codemirror/lang-sql').then(m => m.sql({ dialect: m[dialectName] }));
}
/**
An array of language descriptions for known language packages.
*/
const languages = [
    // New-style language modes
    /*@__PURE__*/LanguageDescription.of({
        name: "C",
        extensions: ["c", "h", "ino"],
        load() {
            return import('@codemirror/lang-cpp').then(m => m.cpp());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "C++",
        alias: ["cpp"],
        extensions: ["cpp", "c++", "cc", "cxx", "hpp", "h++", "hh", "hxx"],
        load() {
            return import('@codemirror/lang-cpp').then(m => m.cpp());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "CQL",
        alias: ["cassandra"],
        extensions: ["cql"],
        load() { return sql("Cassandra"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "CSS",
        extensions: ["css"],
        load() {
            return import('@codemirror/lang-css').then(m => m.css());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Go",
        extensions: ["go"],
        load() {
            return import('@codemirror/lang-go').then(m => m.go());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "HTML",
        alias: ["xhtml"],
        extensions: ["html", "htm", "handlebars", "hbs"],
        load() {
            return import('@codemirror/lang-html').then(m => m.html());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Java",
        extensions: ["java"],
        load() {
            return import('@codemirror/lang-java').then(m => m.java());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "JavaScript",
        alias: ["ecmascript", "js", "node"],
        extensions: ["js", "mjs", "cjs"],
        load() {
            return import('@codemirror/lang-javascript').then(m => m.javascript());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Jinja",
        extensions: ["j2", "jinja", "jinja2"],
        load() {
            return import('@codemirror/lang-jinja').then(m => m.jinja());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "JSON",
        alias: ["json5"],
        extensions: ["json", "map"],
        load() {
            return import('@codemirror/lang-json').then(m => m.json());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "JSX",
        extensions: ["jsx"],
        load() {
            return import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true }));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "LESS",
        extensions: ["less"],
        load() {
            return import('@codemirror/lang-less').then(m => m.less());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Liquid",
        extensions: ["liquid"],
        load() {
            return import('@codemirror/lang-liquid').then(m => m.liquid());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MariaDB SQL",
        load() { return sql("MariaSQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Markdown",
        extensions: ["md", "markdown", "mkd"],
        load() {
            return import('@codemirror/lang-markdown').then(m => m.markdown());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MS SQL",
        load() { return sql("MSSQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MySQL",
        load() { return sql("MySQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "PHP",
        extensions: ["php", "php3", "php4", "php5", "php7", "phtml"],
        load() {
            return import('@codemirror/lang-php').then(m => m.php());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "PLSQL",
        extensions: ["pls"],
        load() { return sql("PLSQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "PostgreSQL",
        load() { return sql("PostgreSQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Python",
        extensions: ["BUILD", "bzl", "py", "pyw"],
        filename: /^(BUCK|BUILD)$/,
        load() {
            return import('@codemirror/lang-python').then(m => m.python());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Rust",
        extensions: ["rs"],
        load() {
            return import('@codemirror/lang-rust').then(m => m.rust());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Sass",
        extensions: ["sass"],
        load() {
            return import('@codemirror/lang-sass').then(m => m.sass({ indented: true }));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SCSS",
        extensions: ["scss"],
        load() {
            return import('@codemirror/lang-sass').then(m => m.sass());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SQL",
        extensions: ["sql"],
        load() { return sql("StandardSQL"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SQLite",
        load() { return sql("SQLite"); }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TSX",
        extensions: ["tsx"],
        load() {
            return import('@codemirror/lang-javascript').then(m => m.javascript({ jsx: true, typescript: true }));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TypeScript",
        alias: ["ts"],
        extensions: ["ts", "mts", "cts"],
        load() {
            return import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: true }));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "WebAssembly",
        extensions: ["wat", "wast"],
        load() {
            return import('@codemirror/lang-wast').then(m => m.wast());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "XML",
        alias: ["rss", "wsdl", "xsd"],
        extensions: ["xml", "xsl", "xsd", "svg"],
        load() {
            return import('@codemirror/lang-xml').then(m => m.xml());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "YAML",
        alias: ["yml"],
        extensions: ["yaml", "yml"],
        load() {
            return import('@codemirror/lang-yaml').then(m => m.yaml());
        }
    }),
    // Legacy modes ported from CodeMirror 5
    /*@__PURE__*/LanguageDescription.of({
        name: "APL",
        extensions: ["dyalog", "apl"],
        load() {
            return import('@codemirror/legacy-modes/mode/apl').then(m => legacy(m.apl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "PGP",
        alias: ["asciiarmor"],
        extensions: ["asc", "pgp", "sig"],
        load() {
            return import('@codemirror/legacy-modes/mode/asciiarmor').then(m => legacy(m.asciiArmor));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "ASN.1",
        extensions: ["asn", "asn1"],
        load() {
            return import('@codemirror/legacy-modes/mode/asn1').then(m => legacy(m.asn1({})));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Asterisk",
        filename: /^extensions\.conf$/i,
        load() {
            return import('@codemirror/legacy-modes/mode/asterisk').then(m => legacy(m.asterisk));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Brainfuck",
        extensions: ["b", "bf"],
        load() {
            return import('@codemirror/legacy-modes/mode/brainfuck').then(m => legacy(m.brainfuck));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Cobol",
        extensions: ["cob", "cpy"],
        load() {
            return import('@codemirror/legacy-modes/mode/cobol').then(m => legacy(m.cobol));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "C#",
        alias: ["csharp", "cs"],
        extensions: ["cs"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.csharp));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Clojure",
        extensions: ["clj", "cljc", "cljx"],
        load() {
            return import('@codemirror/legacy-modes/mode/clojure').then(m => legacy(m.clojure));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "ClojureScript",
        extensions: ["cljs"],
        load() {
            return import('@codemirror/legacy-modes/mode/clojure').then(m => legacy(m.clojure));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Closure Stylesheets (GSS)",
        extensions: ["gss"],
        load() {
            return import('@codemirror/legacy-modes/mode/css').then(m => legacy(m.gss));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "CMake",
        extensions: ["cmake", "cmake.in"],
        filename: /^CMakeLists\.txt$/,
        load() {
            return import('@codemirror/legacy-modes/mode/cmake').then(m => legacy(m.cmake));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "CoffeeScript",
        alias: ["coffee", "coffee-script"],
        extensions: ["coffee"],
        load() {
            return import('@codemirror/legacy-modes/mode/coffeescript').then(m => legacy(m.coffeeScript));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Common Lisp",
        alias: ["lisp"],
        extensions: ["cl", "lisp", "el"],
        load() {
            return import('@codemirror/legacy-modes/mode/commonlisp').then(m => legacy(m.commonLisp));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Cypher",
        extensions: ["cyp", "cypher"],
        load() {
            return import('@codemirror/legacy-modes/mode/cypher').then(m => legacy(m.cypher));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Cython",
        extensions: ["pyx", "pxd", "pxi"],
        load() {
            return import('@codemirror/legacy-modes/mode/python').then(m => legacy(m.cython));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Crystal",
        extensions: ["cr"],
        load() {
            return import('@codemirror/legacy-modes/mode/crystal').then(m => legacy(m.crystal));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "D",
        extensions: ["d"],
        load() {
            return import('@codemirror/legacy-modes/mode/d').then(m => legacy(m.d));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Dart",
        extensions: ["dart"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.dart));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "diff",
        extensions: ["diff", "patch"],
        load() {
            return import('@codemirror/legacy-modes/mode/diff').then(m => legacy(m.diff));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Dockerfile",
        filename: /^Dockerfile$/,
        load() {
            return import('@codemirror/legacy-modes/mode/dockerfile').then(m => legacy(m.dockerFile));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "DTD",
        extensions: ["dtd"],
        load() {
            return import('@codemirror/legacy-modes/mode/dtd').then(m => legacy(m.dtd));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Dylan",
        extensions: ["dylan", "dyl", "intr"],
        load() {
            return import('@codemirror/legacy-modes/mode/dylan').then(m => legacy(m.dylan));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "EBNF",
        load() {
            return import('@codemirror/legacy-modes/mode/ebnf').then(m => legacy(m.ebnf));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "ECL",
        extensions: ["ecl"],
        load() {
            return import('@codemirror/legacy-modes/mode/ecl').then(m => legacy(m.ecl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "edn",
        extensions: ["edn"],
        load() {
            return import('@codemirror/legacy-modes/mode/clojure').then(m => legacy(m.clojure));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Eiffel",
        extensions: ["e"],
        load() {
            return import('@codemirror/legacy-modes/mode/eiffel').then(m => legacy(m.eiffel));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Elm",
        extensions: ["elm"],
        load() {
            return import('@codemirror/legacy-modes/mode/elm').then(m => legacy(m.elm));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Erlang",
        extensions: ["erl"],
        load() {
            return import('@codemirror/legacy-modes/mode/erlang').then(m => legacy(m.erlang));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Esper",
        load() {
            return import('@codemirror/legacy-modes/mode/sql').then(m => legacy(m.esper));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Factor",
        extensions: ["factor"],
        load() {
            return import('@codemirror/legacy-modes/mode/factor').then(m => legacy(m.factor));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "FCL",
        load() {
            return import('@codemirror/legacy-modes/mode/fcl').then(m => legacy(m.fcl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Forth",
        extensions: ["forth", "fth", "4th"],
        load() {
            return import('@codemirror/legacy-modes/mode/forth').then(m => legacy(m.forth));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Fortran",
        extensions: ["f", "for", "f77", "f90", "f95"],
        load() {
            return import('@codemirror/legacy-modes/mode/fortran').then(m => legacy(m.fortran));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "F#",
        alias: ["fsharp"],
        extensions: ["fs"],
        load() {
            return import('@codemirror/legacy-modes/mode/mllike').then(m => legacy(m.fSharp));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Gas",
        extensions: ["s"],
        load() {
            return import('@codemirror/legacy-modes/mode/gas').then(m => legacy(m.gas));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Gherkin",
        extensions: ["feature"],
        load() {
            return import('@codemirror/legacy-modes/mode/gherkin').then(m => legacy(m.gherkin));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Groovy",
        extensions: ["groovy", "gradle"],
        filename: /^Jenkinsfile$/,
        load() {
            return import('@codemirror/legacy-modes/mode/groovy').then(m => legacy(m.groovy));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Haskell",
        extensions: ["hs"],
        load() {
            return import('@codemirror/legacy-modes/mode/haskell').then(m => legacy(m.haskell));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Haxe",
        extensions: ["hx"],
        load() {
            return import('@codemirror/legacy-modes/mode/haxe').then(m => legacy(m.haxe));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "HXML",
        extensions: ["hxml"],
        load() {
            return import('@codemirror/legacy-modes/mode/haxe').then(m => legacy(m.hxml));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "HTTP",
        load() {
            return import('@codemirror/legacy-modes/mode/http').then(m => legacy(m.http));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "IDL",
        extensions: ["pro"],
        load() {
            return import('@codemirror/legacy-modes/mode/idl').then(m => legacy(m.idl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "JSON-LD",
        alias: ["jsonld"],
        extensions: ["jsonld"],
        load() {
            return import('@codemirror/legacy-modes/mode/javascript').then(m => legacy(m.jsonld));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Julia",
        extensions: ["jl"],
        load() {
            return import('@codemirror/legacy-modes/mode/julia').then(m => legacy(m.julia));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Kotlin",
        extensions: ["kt", "kts"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.kotlin));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "LiveScript",
        alias: ["ls"],
        extensions: ["ls"],
        load() {
            return import('@codemirror/legacy-modes/mode/livescript').then(m => legacy(m.liveScript));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Lua",
        extensions: ["lua"],
        load() {
            return import('@codemirror/legacy-modes/mode/lua').then(m => legacy(m.lua));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "mIRC",
        extensions: ["mrc"],
        load() {
            return import('@codemirror/legacy-modes/mode/mirc').then(m => legacy(m.mirc));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Mathematica",
        extensions: ["m", "nb", "wl", "wls"],
        load() {
            return import('@codemirror/legacy-modes/mode/mathematica').then(m => legacy(m.mathematica));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Modelica",
        extensions: ["mo"],
        load() {
            return import('@codemirror/legacy-modes/mode/modelica').then(m => legacy(m.modelica));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MUMPS",
        extensions: ["mps"],
        load() {
            return import('@codemirror/legacy-modes/mode/mumps').then(m => legacy(m.mumps));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Mbox",
        extensions: ["mbox"],
        load() {
            return import('@codemirror/legacy-modes/mode/mbox').then(m => legacy(m.mbox));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Nginx",
        filename: /nginx.*\.conf$/i,
        load() {
            return import('@codemirror/legacy-modes/mode/nginx').then(m => legacy(m.nginx));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "NSIS",
        extensions: ["nsh", "nsi"],
        load() {
            return import('@codemirror/legacy-modes/mode/nsis').then(m => legacy(m.nsis));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "NTriples",
        extensions: ["nt", "nq"],
        load() {
            return import('@codemirror/legacy-modes/mode/ntriples').then(m => legacy(m.ntriples));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Objective-C",
        alias: ["objective-c", "objc"],
        extensions: ["m"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.objectiveC));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Objective-C++",
        alias: ["objective-c++", "objc++"],
        extensions: ["mm"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.objectiveCpp));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "OCaml",
        extensions: ["ml", "mli", "mll", "mly"],
        load() {
            return import('@codemirror/legacy-modes/mode/mllike').then(m => legacy(m.oCaml));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Octave",
        extensions: ["m"],
        load() {
            return import('@codemirror/legacy-modes/mode/octave').then(m => legacy(m.octave));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Oz",
        extensions: ["oz"],
        load() {
            return import('@codemirror/legacy-modes/mode/oz').then(m => legacy(m.oz));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Pascal",
        extensions: ["p", "pas"],
        load() {
            return import('@codemirror/legacy-modes/mode/pascal').then(m => legacy(m.pascal));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Perl",
        extensions: ["pl", "pm"],
        load() {
            return import('@codemirror/legacy-modes/mode/perl').then(m => legacy(m.perl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Pig",
        extensions: ["pig"],
        load() {
            return import('@codemirror/legacy-modes/mode/pig').then(m => legacy(m.pig));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "PowerShell",
        extensions: ["ps1", "psd1", "psm1"],
        load() {
            return import('@codemirror/legacy-modes/mode/powershell').then(m => legacy(m.powerShell));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Properties files",
        alias: ["ini", "properties"],
        extensions: ["properties", "ini", "in"],
        load() {
            return import('@codemirror/legacy-modes/mode/properties').then(m => legacy(m.properties));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "ProtoBuf",
        extensions: ["proto"],
        load() {
            return import('@codemirror/legacy-modes/mode/protobuf').then(m => legacy(m.protobuf));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Pug",
        alias: ["jade"],
        extensions: ["pug", "jade"],
        load() {
            return import('@codemirror/legacy-modes/mode/pug').then(m => legacy(m.pug));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Puppet",
        extensions: ["pp"],
        load() {
            return import('@codemirror/legacy-modes/mode/puppet').then(m => legacy(m.puppet));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Q",
        extensions: ["q"],
        load() {
            return import('@codemirror/legacy-modes/mode/q').then(m => legacy(m.q));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "R",
        alias: ["rscript"],
        extensions: ["r", "R"],
        load() {
            return import('@codemirror/legacy-modes/mode/r').then(m => legacy(m.r));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "RPM Changes",
        load() {
            return import('@codemirror/legacy-modes/mode/rpm').then(m => legacy(m.rpmChanges));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "RPM Spec",
        extensions: ["spec"],
        load() {
            return import('@codemirror/legacy-modes/mode/rpm').then(m => legacy(m.rpmSpec));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Ruby",
        alias: ["jruby", "macruby", "rake", "rb", "rbx"],
        extensions: ["rb"],
        filename: /^(Gemfile|Rakefile)$/,
        load() {
            return import('@codemirror/legacy-modes/mode/ruby').then(m => legacy(m.ruby));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SAS",
        extensions: ["sas"],
        load() {
            return import('@codemirror/legacy-modes/mode/sas').then(m => legacy(m.sas));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Scala",
        extensions: ["scala"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.scala));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Scheme",
        extensions: ["scm", "ss"],
        load() {
            return import('@codemirror/legacy-modes/mode/scheme').then(m => legacy(m.scheme));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Shell",
        alias: ["bash", "sh", "zsh"],
        extensions: ["sh", "ksh", "bash"],
        filename: /^PKGBUILD$/,
        load() {
            return import('@codemirror/legacy-modes/mode/shell').then(m => legacy(m.shell));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Sieve",
        extensions: ["siv", "sieve"],
        load() {
            return import('@codemirror/legacy-modes/mode/sieve').then(m => legacy(m.sieve));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Smalltalk",
        extensions: ["st"],
        load() {
            return import('@codemirror/legacy-modes/mode/smalltalk').then(m => legacy(m.smalltalk));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Solr",
        load() {
            return import('@codemirror/legacy-modes/mode/solr').then(m => legacy(m.solr));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SML",
        extensions: ["sml", "sig", "fun", "smackspec"],
        load() {
            return import('@codemirror/legacy-modes/mode/mllike').then(m => legacy(m.sml));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SPARQL",
        alias: ["sparul"],
        extensions: ["rq", "sparql"],
        load() {
            return import('@codemirror/legacy-modes/mode/sparql').then(m => legacy(m.sparql));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Spreadsheet",
        alias: ["excel", "formula"],
        load() {
            return import('@codemirror/legacy-modes/mode/spreadsheet').then(m => legacy(m.spreadsheet));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Squirrel",
        extensions: ["nut"],
        load() {
            return import('@codemirror/legacy-modes/mode/clike').then(m => legacy(m.squirrel));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Stylus",
        extensions: ["styl"],
        load() {
            return import('@codemirror/legacy-modes/mode/stylus').then(m => legacy(m.stylus));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Swift",
        extensions: ["swift"],
        load() {
            return import('@codemirror/legacy-modes/mode/swift').then(m => legacy(m.swift));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "sTeX",
        load() {
            return import('@codemirror/legacy-modes/mode/stex').then(m => legacy(m.stex));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "LaTeX",
        alias: ["tex"],
        extensions: ["text", "ltx", "tex"],
        load() {
            return import('@codemirror/legacy-modes/mode/stex').then(m => legacy(m.stex));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "SystemVerilog",
        extensions: ["v", "sv", "svh"],
        load() {
            return import('@codemirror/legacy-modes/mode/verilog').then(m => legacy(m.verilog));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Tcl",
        extensions: ["tcl"],
        load() {
            return import('@codemirror/legacy-modes/mode/tcl').then(m => legacy(m.tcl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Textile",
        extensions: ["textile"],
        load() {
            return import('@codemirror/legacy-modes/mode/textile').then(m => legacy(m.textile));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TiddlyWiki",
        load() {
            return import('@codemirror/legacy-modes/mode/tiddlywiki').then(m => legacy(m.tiddlyWiki));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Tiki wiki",
        load() {
            return import('@codemirror/legacy-modes/mode/tiki').then(m => legacy(m.tiki));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TOML",
        extensions: ["toml"],
        load() {
            return import('@codemirror/legacy-modes/mode/toml').then(m => legacy(m.toml));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Troff",
        extensions: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        load() {
            return import('@codemirror/legacy-modes/mode/troff').then(m => legacy(m.troff));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TTCN",
        extensions: ["ttcn", "ttcn3", "ttcnpp"],
        load() {
            return import('@codemirror/legacy-modes/mode/ttcn').then(m => legacy(m.ttcn));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "TTCN_CFG",
        extensions: ["cfg"],
        load() {
            return import('@codemirror/legacy-modes/mode/ttcn-cfg').then(m => legacy(m.ttcnCfg));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Turtle",
        extensions: ["ttl"],
        load() {
            return import('@codemirror/legacy-modes/mode/turtle').then(m => legacy(m.turtle));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Web IDL",
        extensions: ["webidl"],
        load() {
            return import('@codemirror/legacy-modes/mode/webidl').then(m => legacy(m.webIDL));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "VB.NET",
        extensions: ["vb"],
        load() {
            return import('@codemirror/legacy-modes/mode/vb').then(m => legacy(m.vb));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "VBScript",
        extensions: ["vbs"],
        load() {
            return import('@codemirror/legacy-modes/mode/vbscript').then(m => legacy(m.vbScript));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Velocity",
        extensions: ["vtl"],
        load() {
            return import('@codemirror/legacy-modes/mode/velocity').then(m => legacy(m.velocity));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Verilog",
        extensions: ["v"],
        load() {
            return import('@codemirror/legacy-modes/mode/verilog').then(m => legacy(m.verilog));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "VHDL",
        extensions: ["vhd", "vhdl"],
        load() {
            return import('@codemirror/legacy-modes/mode/vhdl').then(m => legacy(m.vhdl));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "XQuery",
        extensions: ["xy", "xquery", "xq", "xqm", "xqy"],
        load() {
            return import('@codemirror/legacy-modes/mode/xquery').then(m => legacy(m.xQuery));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Yacas",
        extensions: ["ys"],
        load() {
            return import('@codemirror/legacy-modes/mode/yacas').then(m => legacy(m.yacas));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Z80",
        extensions: ["z80"],
        load() {
            return import('@codemirror/legacy-modes/mode/z80').then(m => legacy(m.z80));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MscGen",
        extensions: ["mscgen", "mscin", "msc"],
        load() {
            return import('@codemirror/legacy-modes/mode/mscgen').then(m => legacy(m.mscgen));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Xù",
        extensions: ["xu"],
        load() {
            return import('@codemirror/legacy-modes/mode/mscgen').then(m => legacy(m.xu));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "MsGenny",
        extensions: ["msgenny"],
        load() {
            return import('@codemirror/legacy-modes/mode/mscgen').then(m => legacy(m.msgenny));
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Vue",
        extensions: ["vue"],
        load() {
            return import('@codemirror/lang-vue').then(m => m.vue());
        }
    }),
    /*@__PURE__*/LanguageDescription.of({
        name: "Angular Template",
        load() {
            return import('@codemirror/lang-angular').then(m => m.angular());
        }
    })
];

export { languages };
