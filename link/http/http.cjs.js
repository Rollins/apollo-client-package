'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var utils = require('../utils');
var tsInvariant = require('ts-invariant');
var tslib = require('tslib');
var graphql = require('graphql');
var core = require('../core');
var utilities = require('../../utilities');

var hasOwnProperty = Object.prototype.hasOwnProperty;
function parseAndCheckHttpResponse(operations) {
    return function (response) { return response
        .text()
        .then(function (bodyText) {
        try {
            return JSON.parse(bodyText);
        }
        catch (err) {
            var parseError = err;
            parseError.name = 'ServerParseError';
            parseError.response = response;
            parseError.statusCode = response.status;
            parseError.bodyText = bodyText;
            throw parseError;
        }
    })
        .then(function (result) {
        if (response.status >= 300) {
            utils.throwServerError(response, result, "Response not successful: Received status code " + response.status);
        }
        if (!Array.isArray(result) &&
            !hasOwnProperty.call(result, 'data') &&
            !hasOwnProperty.call(result, 'errors')) {
            utils.throwServerError(response, result, "Server response was missing for query '" + (Array.isArray(operations)
                ? operations.map(function (op) { return op.operationName; })
                : operations.operationName) + "'.");
        }
        return result;
    }); };
}

var serializeFetchParameter = function (p, label) {
    var serialized;
    try {
        serialized = JSON.stringify(p);
    }
    catch (e) {
        var parseError = process.env.NODE_ENV === "production" ? new tsInvariant.InvariantError(23) : new tsInvariant.InvariantError("Network request failed. " + label + " is not serializable: " + e.message);
        parseError.parseError = e;
        throw parseError;
    }
    return serialized;
};

var print = function (node) {
    return graphql.stripIgnoredCharacters(graphql.print(node));
};

var defaultHttpOptions = {
    includeQuery: true,
    includeExtensions: false,
};
var defaultHeaders = {
    accept: '*/*',
    'content-type': 'application/json',
};
var defaultOptions = {
    method: 'POST',
};
var fallbackHttpConfig = {
    http: defaultHttpOptions,
    headers: defaultHeaders,
    options: defaultOptions,
};
var selectHttpOptionsAndBody = function (operation, fallbackConfig) {
    var configs = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        configs[_i - 2] = arguments[_i];
    }
    var options = tslib.__assign(tslib.__assign({}, fallbackConfig.options), { headers: fallbackConfig.headers, credentials: fallbackConfig.credentials });
    var http = fallbackConfig.http || {};
    configs.forEach(function (config) {
        options = tslib.__assign(tslib.__assign(tslib.__assign({}, options), config.options), { headers: tslib.__assign(tslib.__assign({}, options.headers), config.headers) });
        if (config.credentials)
            options.credentials = config.credentials;
        http = tslib.__assign(tslib.__assign({}, http), config.http);
    });
    var operationName = operation.operationName, extensions = operation.extensions, variables = operation.variables, query = operation.query;
    var body = { operationName: operationName, variables: variables };
    if (http.includeExtensions)
        body.extensions = extensions;
    if (http.includeQuery)
        body.query = print(query);
    return {
        options: options,
        body: body,
    };
};

var checkFetcher = function (fetcher) {
    if (!fetcher && typeof fetch === 'undefined') {
        throw process.env.NODE_ENV === "production" ? new tsInvariant.InvariantError(22) : new tsInvariant.InvariantError("\n\"fetch\" has not been found globally and no fetcher has been configured. To fix this, install a fetch package (like https://www.npmjs.com/package/cross-fetch), instantiate the fetcher, and pass it into your HttpLink constructor. For example:\n\nimport fetch from 'cross-fetch';\nimport { ApolloClient, HttpLink } from '@apollo/client';\nconst client = new ApolloClient({\n  link: new HttpLink({ uri: '/graphql', fetch })\n});\n    ");
    }
};

var createSignalIfSupported = function () {
    if (typeof AbortController === 'undefined')
        return { controller: false, signal: false };
    var controller = new AbortController();
    var signal = controller.signal;
    return { controller: controller, signal: signal };
};

var selectURI = function (operation, fallbackURI) {
    var context = operation.getContext();
    var contextURI = context.uri;
    if (contextURI) {
        return contextURI;
    }
    else if (typeof fallbackURI === 'function') {
        return fallbackURI(operation);
    }
    else {
        return fallbackURI || '/graphql';
    }
};

function rewriteURIForGET(chosenURI, body) {
    var queryParams = [];
    var addQueryParam = function (key, value) {
        queryParams.push(key + "=" + encodeURIComponent(value));
    };
    if ('query' in body) {
        addQueryParam('query', body.query);
    }
    if (body.operationName) {
        addQueryParam('operationName', body.operationName);
    }
    if (body.variables) {
        var serializedVariables = void 0;
        try {
            serializedVariables = serializeFetchParameter(body.variables, 'Variables map');
        }
        catch (parseError) {
            return { parseError: parseError };
        }
        addQueryParam('variables', serializedVariables);
    }
    if (body.extensions) {
        var serializedExtensions = void 0;
        try {
            serializedExtensions = serializeFetchParameter(body.extensions, 'Extensions map');
        }
        catch (parseError) {
            return { parseError: parseError };
        }
        addQueryParam('extensions', serializedExtensions);
    }
    var fragment = '', preFragment = chosenURI;
    var fragmentStart = chosenURI.indexOf('#');
    if (fragmentStart !== -1) {
        fragment = chosenURI.substr(fragmentStart);
        preFragment = chosenURI.substr(0, fragmentStart);
    }
    var queryParamsPrefix = preFragment.indexOf('?') === -1 ? '?' : '&';
    var newURI = preFragment + queryParamsPrefix + queryParams.join('&') + fragment;
    return { newURI: newURI };
}

var createHttpLink = function (linkOptions) {
    if (linkOptions === void 0) { linkOptions = {}; }
    var _a = linkOptions.uri, uri = _a === void 0 ? '/graphql' : _a, fetcher = linkOptions.fetch, includeExtensions = linkOptions.includeExtensions, useGETForQueries = linkOptions.useGETForQueries, _b = linkOptions.includeUnusedVariables, includeUnusedVariables = _b === void 0 ? false : _b, requestOptions = tslib.__rest(linkOptions, ["uri", "fetch", "includeExtensions", "useGETForQueries", "includeUnusedVariables"]);
    checkFetcher(fetcher);
    if (!fetcher) {
        fetcher = fetch;
    }
    var linkConfig = {
        http: { includeExtensions: includeExtensions },
        options: requestOptions.fetchOptions,
        credentials: requestOptions.credentials,
        headers: requestOptions.headers,
    };
    return new core.ApolloLink(function (operation) {
        var chosenURI = selectURI(operation, uri);
        var context = operation.getContext();
        var clientAwarenessHeaders = {};
        if (context.clientAwareness) {
            var _a = context.clientAwareness, name_1 = _a.name, version = _a.version;
            if (name_1) {
                clientAwarenessHeaders['apollographql-client-name'] = name_1;
            }
            if (version) {
                clientAwarenessHeaders['apollographql-client-version'] = version;
            }
        }
        var contextHeaders = tslib.__assign(tslib.__assign({}, clientAwarenessHeaders), context.headers);
        var contextConfig = {
            http: context.http,
            options: context.fetchOptions,
            credentials: context.credentials,
            headers: contextHeaders,
        };
        var _b = selectHttpOptionsAndBody(operation, fallbackHttpConfig, linkConfig, contextConfig), options = _b.options, body = _b.body;
        if (body.variables && !includeUnusedVariables) {
            var unusedNames_1 = new Set(Object.keys(body.variables));
            graphql.visit(operation.query, {
                Variable: function (node, _key, parent) {
                    if (parent && parent.kind !== 'VariableDefinition') {
                        unusedNames_1.delete(node.name.value);
                    }
                },
            });
            if (unusedNames_1.size) {
                body.variables = tslib.__assign({}, body.variables);
                unusedNames_1.forEach(function (name) {
                    delete body.variables[name];
                });
            }
        }
        var controller;
        if (!options.signal) {
            var _c = createSignalIfSupported(), _controller = _c.controller, signal = _c.signal;
            controller = _controller;
            if (controller)
                options.signal = signal;
        }
        var definitionIsMutation = function (d) {
            return d.kind === 'OperationDefinition' && d.operation === 'mutation';
        };
        if (useGETForQueries &&
            !operation.query.definitions.some(definitionIsMutation)) {
            options.method = 'GET';
        }
        if (options.method === 'GET') {
            var _d = rewriteURIForGET(chosenURI, body), newURI = _d.newURI, parseError = _d.parseError;
            if (parseError) {
                return utils.fromError(parseError);
            }
            chosenURI = newURI;
        }
        else {
            try {
                options.body = serializeFetchParameter(body, 'Payload');
            }
            catch (parseError) {
                return utils.fromError(parseError);
            }
        }
        return new utilities.Observable(function (observer) {
            fetcher(chosenURI, options)
                .then(function (response) {
                operation.setContext({ response: response });
                return response;
            })
                .then(parseAndCheckHttpResponse(operation))
                .then(function (result) {
                observer.next(result);
                observer.complete();
                return result;
            })
                .catch(function (err) {
                if (err.name === 'AbortError')
                    return;
                if (err.result && err.result.errors && err.result.data) {
                    observer.next(err.result);
                }
                observer.error(err);
            });
            return function () {
                if (controller)
                    controller.abort();
            };
        });
    });
};

var HttpLink = (function (_super) {
    tslib.__extends(HttpLink, _super);
    function HttpLink(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this, createHttpLink(options).request) || this;
        _this.options = options;
        return _this;
    }
    return HttpLink;
}(core.ApolloLink));

exports.HttpLink = HttpLink;
exports.checkFetcher = checkFetcher;
exports.createHttpLink = createHttpLink;
exports.createSignalIfSupported = createSignalIfSupported;
exports.fallbackHttpConfig = fallbackHttpConfig;
exports.parseAndCheckHttpResponse = parseAndCheckHttpResponse;
exports.rewriteURIForGET = rewriteURIForGET;
exports.selectHttpOptionsAndBody = selectHttpOptionsAndBody;
exports.selectURI = selectURI;
exports.serializeFetchParameter = serializeFetchParameter;
//# sourceMappingURL=http.cjs.js.map
