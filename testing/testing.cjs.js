'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var tslib = require('tslib');
var React = _interopDefault(require('react'));
var core = require('../core');
var cache = require('../cache');
var context = require('../react/context');
var graphql = require('graphql');
var equality = require('@wry/equality');
var tsInvariant = require('ts-invariant');
var core$1 = require('../link/core');
var utilities = require('../utilities');
var Observable = _interopDefault(require('zen-observable'));
require('symbol-observable');

var print = function (node) {
    return graphql.stripIgnoredCharacters(graphql.print(node));
};

function requestToKey(request, addTypename) {
    var queryString = request.query &&
        print(addTypename ? utilities.addTypenameToDocument(request.query) : request.query);
    var requestKey = { query: queryString };
    return JSON.stringify(requestKey);
}
var MockLink = (function (_super) {
    tslib.__extends(MockLink, _super);
    function MockLink(mockedResponses, addTypename) {
        if (addTypename === void 0) { addTypename = true; }
        var _this = _super.call(this) || this;
        _this.addTypename = true;
        _this.mockedResponsesByKey = {};
        _this.addTypename = addTypename;
        if (mockedResponses) {
            mockedResponses.forEach(function (mockedResponse) {
                _this.addMockedResponse(mockedResponse);
            });
        }
        return _this;
    }
    MockLink.prototype.addMockedResponse = function (mockedResponse) {
        var normalizedMockedResponse = this.normalizeMockedResponse(mockedResponse);
        var key = requestToKey(normalizedMockedResponse.request, this.addTypename);
        var mockedResponses = this.mockedResponsesByKey[key];
        if (!mockedResponses) {
            mockedResponses = [];
            this.mockedResponsesByKey[key] = mockedResponses;
        }
        mockedResponses.push(normalizedMockedResponse);
    };
    MockLink.prototype.request = function (operation) {
        var _this = this;
        this.operation = operation;
        var key = requestToKey(operation, this.addTypename);
        var responseIndex = 0;
        var response = (this.mockedResponsesByKey[key] || []).find(function (res, index) {
            var requestVariables = operation.variables || {};
            var mockedResponseVariables = res.request.variables || {};
            if (equality.equal(requestVariables, mockedResponseVariables)) {
                responseIndex = index;
                return true;
            }
            return false;
        });
        var configError;
        if (!response || typeof responseIndex === 'undefined') {
            configError = new Error("No more mocked responses for the query: " + print(operation.query) + ", variables: " + JSON.stringify(operation.variables));
        }
        else {
            this.mockedResponsesByKey[key].splice(responseIndex, 1);
            var newData = response.newData;
            if (newData) {
                response.result = newData();
                this.mockedResponsesByKey[key].push(response);
            }
            if (!response.result && !response.error) {
                configError = new Error("Mocked response should contain either result or error: " + key);
            }
        }
        return new utilities.Observable(function (observer) {
            var timer = setTimeout(function () {
                if (configError) {
                    try {
                        if (_this.onError(configError, observer) !== false) {
                            throw configError;
                        }
                    }
                    catch (error) {
                        observer.error(error);
                    }
                }
                else if (response) {
                    if (response.error) {
                        observer.error(response.error);
                    }
                    else {
                        if (response.result) {
                            observer.next(typeof response.result === 'function'
                                ? response.result()
                                : response.result);
                        }
                        observer.complete();
                    }
                }
            }, response && response.delay || 0);
            return function () {
                clearTimeout(timer);
            };
        });
    };
    MockLink.prototype.normalizeMockedResponse = function (mockedResponse) {
        var newMockedResponse = utilities.cloneDeep(mockedResponse);
        var queryWithoutConnection = utilities.removeConnectionDirectiveFromDocument(newMockedResponse.request.query);
        process.env.NODE_ENV === "production" ? tsInvariant.invariant(queryWithoutConnection, 54) : tsInvariant.invariant(queryWithoutConnection, "query is required");
        newMockedResponse.request.query = queryWithoutConnection;
        var query = utilities.removeClientSetsFromDocument(newMockedResponse.request.query);
        if (query) {
            newMockedResponse.request.query = query;
        }
        return newMockedResponse;
    };
    return MockLink;
}(core$1.ApolloLink));
function mockSingleLink() {
    var mockedResponses = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        mockedResponses[_i] = arguments[_i];
    }
    var maybeTypename = mockedResponses[mockedResponses.length - 1];
    var mocks = mockedResponses.slice(0, mockedResponses.length - 1);
    if (typeof maybeTypename !== 'boolean') {
        mocks = mockedResponses;
        maybeTypename = true;
    }
    return new MockLink(mocks, maybeTypename);
}

var MockedProvider = (function (_super) {
    tslib.__extends(MockedProvider, _super);
    function MockedProvider(props) {
        var _this = _super.call(this, props) || this;
        var _a = _this.props, mocks = _a.mocks, addTypename = _a.addTypename, defaultOptions = _a.defaultOptions, cache$1 = _a.cache, resolvers = _a.resolvers, link = _a.link;
        var client = new core.ApolloClient({
            cache: cache$1 || new cache.InMemoryCache({ addTypename: addTypename }),
            defaultOptions: defaultOptions,
            link: link || new MockLink(mocks || [], addTypename),
            resolvers: resolvers,
        });
        _this.state = { client: client };
        return _this;
    }
    MockedProvider.prototype.render = function () {
        var _a = this.props, children = _a.children, childProps = _a.childProps;
        return React.isValidElement(children) ? (React.createElement(context.ApolloProvider, { client: this.state.client }, React.cloneElement(React.Children.only(children), tslib.__assign({}, childProps)))) : null;
    };
    MockedProvider.prototype.componentWillUnmount = function () {
        this.state.client.stop();
    };
    MockedProvider.defaultProps = {
        addTypename: true
    };
    return MockedProvider;
}(React.Component));

var MockSubscriptionLink = (function (_super) {
    tslib.__extends(MockSubscriptionLink, _super);
    function MockSubscriptionLink() {
        var _this = _super.call(this) || this;
        _this.unsubscribers = [];
        _this.setups = [];
        _this.observers = [];
        return _this;
    }
    MockSubscriptionLink.prototype.request = function (operation) {
        var _this = this;
        this.operation = operation;
        return new utilities.Observable(function (observer) {
            _this.setups.forEach(function (x) { return x(); });
            _this.observers.push(observer);
            return function () {
                _this.unsubscribers.forEach(function (x) { return x(); });
            };
        });
    };
    MockSubscriptionLink.prototype.simulateResult = function (result, complete) {
        var _this = this;
        if (complete === void 0) { complete = false; }
        setTimeout(function () {
            var observers = _this.observers;
            if (!observers.length)
                throw new Error('subscription torn down');
            observers.forEach(function (observer) {
                if (result.result && observer.next)
                    observer.next(result.result);
                if (result.error && observer.error)
                    observer.error(result.error);
                if (complete && observer.complete)
                    observer.complete();
            });
        }, result.delay || 0);
    };
    MockSubscriptionLink.prototype.simulateComplete = function () {
        var observers = this.observers;
        if (!observers.length)
            throw new Error('subscription torn down');
        observers.forEach(function (observer) {
            if (observer.complete)
                observer.complete();
        });
    };
    MockSubscriptionLink.prototype.onSetup = function (listener) {
        this.setups = this.setups.concat([listener]);
    };
    MockSubscriptionLink.prototype.onUnsubscribe = function (listener) {
        this.unsubscribers = this.unsubscribers.concat([listener]);
    };
    return MockSubscriptionLink;
}(core$1.ApolloLink));
function mockObservableLink() {
    return new MockSubscriptionLink();
}

function createMockClient(data, query, variables) {
    if (variables === void 0) { variables = {}; }
    return new core.ApolloClient({
        link: mockSingleLink({
            request: { query: query, variables: variables },
            result: { data: data },
        }).setOnError(function (error) { throw error; }),
        cache: new cache.InMemoryCache({ addTypename: false }),
    });
}

function stripSymbols(data) {
    return JSON.parse(JSON.stringify(data));
}

function asyncMap(observable, mapFn, catchFn) {
    return new Observable(function (observer) {
        var next = observer.next, error = observer.error, complete = observer.complete;
        var activeCallbackCount = 0;
        var completed = false;
        var promiseQueue = {
            then: function (callback) {
                return new Promise(function (resolve) { return resolve(callback()); });
            },
        };
        function makeCallback(examiner, delegate) {
            if (examiner) {
                return function (arg) {
                    ++activeCallbackCount;
                    var both = function () { return examiner(arg); };
                    promiseQueue = promiseQueue.then(both, both).then(function (result) {
                        --activeCallbackCount;
                        next && next.call(observer, result);
                        if (completed) {
                            handler.complete();
                        }
                    }, function (error) {
                        --activeCallbackCount;
                        throw error;
                    }).catch(function (caught) {
                        error && error.call(observer, caught);
                    });
                };
            }
            else {
                return function (arg) { return delegate && delegate.call(observer, arg); };
            }
        }
        var handler = {
            next: makeCallback(mapFn, next),
            error: makeCallback(catchFn, error),
            complete: function () {
                completed = true;
                if (!activeCallbackCount) {
                    complete && complete.call(observer);
                }
            },
        };
        var sub = observable.subscribe(handler);
        return function () { return sub.unsubscribe(); };
    });
}

function subscribeAndCount(reject, observable, cb) {
    var queue = Promise.resolve();
    var handleCount = 0;
    var subscription = asyncMap(observable, function (result) {
        return queue = queue.then(function () {
            return cb(++handleCount, result);
        }).catch(error);
    }).subscribe({ error: error });
    function error(e) {
        subscription.unsubscribe();
        reject(e);
    }
    return subscription;
}

function wrap(key) {
    return function (message, callback, timeout) { return (key ? it[key] : it)(message, function () {
        var _this = this;
        return new Promise(function (resolve, reject) { return callback.call(_this, resolve, reject); });
    }, timeout); };
}
var wrappedIt = wrap();
function itAsync() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return wrappedIt.apply(this, args);
}
(function (itAsync) {
    itAsync.only = wrap("only");
    itAsync.skip = wrap("skip");
    itAsync.todo = wrap("todo");
})(itAsync || (itAsync = {}));

exports.MockLink = MockLink;
exports.MockSubscriptionLink = MockSubscriptionLink;
exports.MockedProvider = MockedProvider;
exports.createMockClient = createMockClient;
exports.itAsync = itAsync;
exports.mockObservableLink = mockObservableLink;
exports.mockSingleLink = mockSingleLink;
exports.stripSymbols = stripSymbols;
exports.subscribeAndCount = subscribeAndCount;
//# sourceMappingURL=testing.cjs.js.map
