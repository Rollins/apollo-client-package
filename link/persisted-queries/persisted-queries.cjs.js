'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var graphql = require('graphql');
var tsInvariant = require('ts-invariant');
var core = require('../core');
var utilities = require('../../utilities');

var print = function (node) {
    return graphql.stripIgnoredCharacters(graphql.print(node));
};

var VERSION = 1;
var defaultOptions = {
    disable: function (_a) {
        var graphQLErrors = _a.graphQLErrors, operation = _a.operation;
        if (graphQLErrors &&
            graphQLErrors.some(function (_a) {
                var message = _a.message;
                return message === 'PersistedQueryNotSupported';
            })) {
            return true;
        }
        var response = operation.getContext().response;
        if (response &&
            response.status &&
            (response.status === 400 || response.status === 500)) {
            return true;
        }
        return false;
    },
    useGETForHashedQueries: false,
};
function operationDefinesMutation(operation) {
    return operation.query.definitions.some(function (d) { return d.kind === 'OperationDefinition' && d.operation === 'mutation'; });
}
var hasOwnProperty = Object.prototype.hasOwnProperty;
var hashesByQuery = new WeakMap();
var nextHashesChildKey = 0;
var createPersistedQueryLink = function (options) {
    process.env.NODE_ENV === "production" ? tsInvariant.invariant(options && (typeof options.sha256 === 'function' ||
        typeof options.generateHash === 'function'), 24) : tsInvariant.invariant(options && (typeof options.sha256 === 'function' ||
        typeof options.generateHash === 'function'), 'Missing/invalid "sha256" or "generateHash" function. Please ' +
        'configure one using the "createPersistedQueryLink(options)" options ' +
        'parameter.');
    var _a = utilities.compact(defaultOptions, options), sha256 = _a.sha256, _b = _a.generateHash, generateHash = _b === void 0 ? function (query) {
        return Promise.resolve(sha256(print(query)));
    } : _b, disable = _a.disable, useGETForHashedQueries = _a.useGETForHashedQueries;
    var supportsPersistedQueries = true;
    var hashesChildKey = 'forLink' + nextHashesChildKey++;
    var getHashPromise = function (query) {
        return new Promise(function (resolve) { return resolve(generateHash(query)); });
    };
    function getQueryHash(query) {
        if (!query || typeof query !== 'object') {
            return getHashPromise(query);
        }
        var hashes = hashesByQuery.get(query);
        if (!hashes)
            hashesByQuery.set(query, hashes = Object.create(null));
        return hasOwnProperty.call(hashes, hashesChildKey)
            ? hashes[hashesChildKey]
            : hashes[hashesChildKey] = getHashPromise(query);
    }
    return new core.ApolloLink(function (operation, forward) {
        process.env.NODE_ENV === "production" ? tsInvariant.invariant(forward, 25) : tsInvariant.invariant(forward, 'PersistedQueryLink cannot be the last link in the chain.');
        var query = operation.query;
        return new utilities.Observable(function (observer) {
            var subscription;
            var retried = false;
            var originalFetchOptions;
            var setFetchOptions = false;
            var retry = function (_a, cb) {
                var response = _a.response, networkError = _a.networkError;
                if (!retried && ((response && response.errors) || networkError)) {
                    retried = true;
                    var disablePayload = {
                        response: response,
                        networkError: networkError,
                        operation: operation,
                        graphQLErrors: response ? response.errors : undefined,
                    };
                    supportsPersistedQueries = !disable(disablePayload);
                    if ((response &&
                        response.errors &&
                        response.errors.some(function (_a) {
                            var message = _a.message;
                            return message === 'PersistedQueryNotFound';
                        })) ||
                        !supportsPersistedQueries) {
                        if (subscription)
                            subscription.unsubscribe();
                        operation.setContext({
                            http: {
                                includeQuery: true,
                                includeExtensions: supportsPersistedQueries,
                            },
                        });
                        if (setFetchOptions) {
                            operation.setContext({ fetchOptions: originalFetchOptions });
                        }
                        subscription = forward(operation).subscribe(handler);
                        return;
                    }
                }
                cb();
            };
            var handler = {
                next: function (response) {
                    retry({ response: response }, function () { return observer.next(response); });
                },
                error: function (networkError) {
                    retry({ networkError: networkError }, function () { return observer.error(networkError); });
                },
                complete: observer.complete.bind(observer),
            };
            operation.setContext({
                http: {
                    includeQuery: !supportsPersistedQueries,
                    includeExtensions: supportsPersistedQueries,
                },
            });
            if (useGETForHashedQueries &&
                supportsPersistedQueries &&
                !operationDefinesMutation(operation)) {
                operation.setContext(function (_a) {
                    var _b = _a.fetchOptions, fetchOptions = _b === void 0 ? {} : _b;
                    originalFetchOptions = fetchOptions;
                    return {
                        fetchOptions: tslib.__assign(tslib.__assign({}, fetchOptions), { method: 'GET' }),
                    };
                });
                setFetchOptions = true;
            }
            if (supportsPersistedQueries) {
                getQueryHash(query).then(function (sha256Hash) {
                    operation.extensions.persistedQuery = {
                        version: VERSION,
                        sha256Hash: sha256Hash,
                    };
                    subscription = forward(operation).subscribe(handler);
                }).catch(observer.error.bind(observer));
            }
            else {
                subscription = forward(operation).subscribe(handler);
            }
            return function () {
                if (subscription)
                    subscription.unsubscribe();
            };
        });
    });
};

exports.VERSION = VERSION;
exports.createPersistedQueryLink = createPersistedQueryLink;
//# sourceMappingURL=persisted-queries.cjs.js.map
