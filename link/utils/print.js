import { print as gqlPrint, stripIgnoredCharacters } from 'graphql';
var print = function (node) {
    return stripIgnoredCharacters(gqlPrint(node));
};
export default print;
//# sourceMappingURL=print.js.map