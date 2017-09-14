
/**
 * Created by nihil on 02/02/15.
 */

var AJS2W2P_TYPES = {
    string: 'text',
    text: 'text',
    boolean: 'checkbox',
    integer: 'number',
    double: 'number',
    decimal: 'number',
    date: 'date',
    time: 'time',
    datetime: 'datetime-local',
    password: 'password',
    upload: '',
    float: 'number',
    reference: '',
    referenced: ''
};

var AJS2W2P_TYPES_TEMPLATE = {
    text: 'text',
    upload: 'upload',
    reference: 'reference',
    referenced: 'references',
    date: 'date',
    datetime: 'datetime',
    boolean: 'boolean'
};
var assign_log = function (debug) {
    if (debug) {
        return function (x) {
            console.log(x);
        }
    } else {
        return angular.noop;
    }
};

var hashCode = function(s){
  return s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);              
}

var renameFunction = function (name, fn) {
    return (new Function("return function (call) { return function " + name +
        " () { return call(this, arguments) }; };")())(Function.apply.bind(fn));
};

function setToParent(scope,name,value){
    if (name in scope){
        var scp = scope;
        var child = scp;
        while (scp && (name in scp)){
            child = scp;
            scp = scp.$parent;
        }
        if (name in child){
            child[name] = value;
        }
    }
}

function capitalize(s) {
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function makeFilter(model, filter) {
    var nvFilter = Lazy(filter).map(function (v, k) {
        if (v.constructor == Array) {
            v = Lazy(v).map(function (x) {
                return [x, 1];
            }).toObject();
        } else if (isFinite(v) || (typeof(v) == 'Number')) {
            var o = {};
            o[v] = 1;
            v = o;
        }
        if (k in model._underscore) {
            k = '_' + k;
        }
        return [k, v];
    }).toObject();
    return function (x) {
        return Lazy(nvFilter).all(function (v, k) {
//            console.log(x[k],' in ',v, x[k] in v,x.toString());
            return x[k] in v
        });
    }
};

var tzOffset = new Date().getTimezoneOffset() * 60000;

var findControllerScope = function (scope) {
    var _scope = scope;
    var _prev = undefined;
    var f = true;
    var myI = Lazy(Lazy(scope).find(function (v, k) {
        return v && v.constructor.$inject
    }).constructor.$inject);
    while (_scope) {
        f = false;
        var found = Lazy(_scope).find(function (v, k) {
            return v && v.constructor.$inject
        });
        if (found) {
            f = myI.difference(found.constructor.$inject).size() == 0;
        }
        /*
         f = false;
         for (var y in _scope) {
         var x = _scope[y];
         try {
         if (x & x.constructor.$inject) {
         f = true;
         break;
         }
         } catch (e) {}
         }
         */
        if (f) {
            _prev = _scope;
            _scope = _scope.$parent;
        } else {
            return _prev || scope.$parent;
        }
    }
    return scope.$parent;
};

(function () {
    //'use strict';
    var reverse = function (chr, str) {
        return str.split(chr).reverse().join(chr);
    };
    var log = null;
    try {
        log = assign_log(true);
    } catch (e) {
        log = angular.noop;
    }
    var makeIndex = function (list, field_name) {
        log('deprecato make index');
        var result = {};
        if (!field_name) field_name = 'id';
        for (var i in list) {
            var item = list[i];
            result[item[field_name]] = item;
        }
        return result;
    };
    var findControllerAs = function (scope, findFunc) {
        var _scope = scope;
        while (_scope) {
            var is = findFunc(_scope);
            if (is) {
                return _scope;
            }
            _scope = _scope.$parent;
        }
    };
    var app = angular.module('web2angular', [/* 'ui.bootstrap', 'ui.bootstrap.buttons'*/]);
    app.config(function ($interpolateProvider) {
        $interpolateProvider.startSymbol('{*');
        $interpolateProvider.endSymbol('*}');
    });
    app.filter('asdatetime', function ($filter) {
        var angularDateFilter = $filter('date');
        return function (theDate) {
            if (!theDate) {
                return '';
            }
            return angularDateFilter(theDate, 'dd/MM/yyyy') + ' alle ' + angularDateFilter(theDate, 'HH:mm:ss');
        }
    });
    app.filter('asdate', function ($filter) {
        var angularDateFilter = $filter('date');
        return function (theDate) {
            if (!theDate) {
                return '';
            }
            return angularDateFilter(theDate, 'dd/MM/yyyy');
        }
    });
    app.filter('asfloat', function(){
        return function(x){
            return Math.round(x * 100) / 100;
        };
    });
    app.service('w2p', function ($http, $rootScope) {
        this.post = function (func, data) {
            var url = '/' + $rootScope.options.application + '/' + func;
            var ret = $http.post(url, data);
            ret.error(function (data, status, evt, xhr) {
                var instance = $uibModal.open({
                    templateUrl: '/lib/rwt/templates/' + ((status == 512) ? 'message.html' : 'error.html'),
                    size: 'lg',
                    controller: function ($scope) {
                        if (status == 512) {
                            var mex = data.split('\n');
                            $scope.title = mex[0];
                            $scope.message = mex[1];
                        } else {
                            try {
                                if ('traceback' in data) {
                                    $scope.traceback = data.traceback;
                                    $scope.exception = data.exception;
                                }
                            } catch (e) {
                                $scope.exception = 'Ticket';
                                $scope.message = data;
                            }
                        }
                        $scope.cancel = function () {
                            //$uibModal.instance.dismiss();
                        };
                    },
                    controlerAs: 'ctrl'
                });
                $uibModal.instance = instance;
            });
            return ret;
        };
        this.get = this.post;
    });
    app.service('w2pResources', function ($http, $rootScope, $interval, $timeout, $parse, $log, $q) {
        //this.resourceCache = {};
        this.fromRealtime = false;
        $rootScope.realtime = false;
        $rootScope.realtimeConnected = false;
        if ($rootScope.options && $rootScope.options.realtime) {
            $rootScope.realtime = true;
            var wsConnect = function () {
                var wizard = function(o){
                    if ('default' in o){
                        o.answer = o.default;
                        delete o.default;
                    }
                    var modalInstance = $uibModal.open({
                        templateUrl :  $rootScope.options.wheelTemplates + 'modal-wizard.html',
                        controller : function($scope,$http){
                            $scope.o = o;
                            if (o.choices){
                                if (o.labels){
                                    $scope.items = Lazy(o.labels).zip(o.choices).map(function(x){return {id : x[1],label : x[0]};}).toArray();
                                } else {
                                    $scope.items = Lazy(o.choices).zip(o.choices).map(function(x){return {id : x[0],label : x[1]};}).toArray();
                                }
                            }
                            var wizAnswer = function(ans){
                                connection.send('WIZARD:-:' + o.wizId + ':-:' + ans);
                                $scope.$dismiss();
                            };
                            $scope.select = function(o){
                                if ($scope.o.multiple){
                                    o._selected = !o._selected;
                                } else {
                                    Lazy($scope.items).each(function(x){x._selected = false;});
                                    o._selected = true;
                                }
                            };
                            $scope.ok = function(){
                                if ($scope.o.open){
                                    wizAnswer($scope.o.answer);
                                } else {
                                    var ans = Lazy($scope.items).filter(function(x){return x._selected}).pluck('id').toArray();
                                    if (ans.length == 0){
                                        if (!$scope.o.mandatory){
                                            wizAnswer(ans);
                                        }
                                    } else {
                                        if ($scope.o.multiple){
                                            wizAnswer(Lazy(ans).join('|:|'));
                                        } else {
                                            wizAnswer(ans[0]);
                                        }
                                    }
                                }
                            };
                            $scope.cancel = function(){wizAnswer(null);};
                            $scope.$on('wizard-timeout',function(evt){
                                $scope.$dismiss();
                            });
                        }
                    });
                };
                var connection = new SockJS($rootScope.options.realtime);
                connection.onopen = function (x) {
                    console.log('open : ' + x);
                    connection.tenant();
                    $rootScope.realtimeConnected = true;
                };
                connection.onmessage = function (x) {
                    if (x.type == 'message') {
                        //$.notify(x.data);
                        try {
                            var data = angular.fromJson(x.data);
                            if (Lazy(data).size()) {
                                if ('WIZARD' in data){
                                    wizard(data.WIZARD);
                                } else if ('SERVER STATUS' in data){
                                    $rootScope.$broadcast('server-status',data['SERVER STATUS']);
                                } else {
                                    W2PRESOURCE.fromRealtime = true;
                                    W2PRESOURCE.gotData(data);
                                    W2PRESOURCE.fromRealtime = false;
                                }
                            }
                        } catch (e) {
                            if (x.data == 'UNKNOWN USER') {
                                var options = {headers: {'Content-Type' : 'text/plain'}};
                                $http.post(base_url + $rootScope.options.application + '/plugin_angular/share_user' , 
                                    {sessionId : $rootScope.options.session_id},
                                    options
                                    ).success(function (data) {
                                        connection.tenant();
                                    });
                            }
                        }
                    }
                    else
                        console.log(x);
                };
                connection.onclose = function () {
                    $timeout(wsConnect, 500);
                    $rootScope.realtimeConnected = false;
                };
                connection.tenant = function () {
                    var sessionId = $rootScope.options.session_id ? '---' + $rootScope.options.session_id : '';
                    connection.send('TENANT:' + $rootScope.options.application + sessionId);
                }
            };
            wsConnect();
        }
        var sameAs = function (x, y) {
            for (var k in x) {
                if (y[k] != x[k]) {
                    return false;
                }
            }
            return true;
        };
        var checkUnlinked = function () {
            var UM = UNLINKED_MODELS.splice(0, UNLINKED_MODELS.length);
            for (var n in UM) {
                var mod = UM[n];
                W2PRESOURCE.describe(mod.to);
            }

            for (var modName in UNLINKED) {
                var ids = [];
                for (var id in UNLINKED[modName]) {
                    ids.push(id);
                }
                if (ids.length) {
                    W2PRESOURCE.get(modName, ids);
                }
            }
        };
        //$interval(checkUnlinked,1000);

        var MANAGEERROR = function (data, status) {
            // form error
            if (status == 513) {
                $rootScope.$broadcast('form-error-' + data._resource, data.errors, data.formIdx);
            } else {
                var finalTemplate = 'error.html';
                var alertOptions = {};
                if (status == 512) {
                    var mex = data.split('\n');
                    alertOptions.title = mex[0];
                    alertOptions.message = 'Unauthorized : ' + mex[1];
                } else if (status == 514) {
                    finalTemplate = 'timeout.html';
                    $rootScope.$broadcast('wizard-timeout');
                } else if (status == 401) {
                    alertOptions.title = 'Unauthorized';
                    alertOptions.message = data;
                } else if (status == 404) {
                    alertOptions.title = 'Not found';
                    alertOptions.message = data;
                } else if (status == 405) {
                    alertOptions.title = 'Method not allowed';
                    alertOptions.message = status + '';
                } else {
                    alertOptions.title = 'HTTP ERROR';
                    alertOptions.message = status + '';
                }
                ons.notification.alert(alertOptions);
            }

/*
                var instance = $uibModal.open({
                    templateUrl: $rootScope.options.wheelTemplates + finalTemplate,
                    size: 'lg',
                    controller: function ($uibModal, $scope) {
                        $scope.status = status;
                        $scope.statusTranslation = {
                            401: 'Unauthorized',
                            404: 'Not found'
                        };
                        if (status == 512) {
                            var mex = data.split('\n');
                            $scope.title = mex[0];
                            $scope.message = mex[1];
                        } else if (status == 401) {
                            $scope.exception = 'Unauthorized';
                            $scope.message = data;
                        } else {
                            try {
                                if ('traceback' in data) {
                                    $scope.traceback = data.traceback;
                                    $scope.exception = data.exception;
                                }
                            } catch (e) {
                                $scope.exception = 'Ticket';
                                $scope.message = data;
                            }
                        }
                        $scope.cancel = function () {
                            $uibModal.instance.dismiss();
                        };
                    },
                    controlerAs: 'ctrl'
                });
                $uibModal.instance = instance;
*/
        };
        var notifier = null;
        $rootScope.$broadcast('server-status',$rootScope.serverStatus);
        $rootScope.$on('server-status',function(evt,status){
            $rootScope.serverStatus = status;
            if (status == 'updating'){
                $.notify('<p>Il server &egrave stato appena riaviato</p><p>&egrave; <b>fortemente</b> raccomandato aggiornare la pagina.</p><p>Per favore premi <b>CTRL + SHIFT + R</b> e aggiornate la pagina non appena possibile.</p><p>fino a quel momento qualcosa <u>potrebbe</u> non funzionare',{delay : 0, allow_dismiss : true});
            }

            if (status == 'ready'){
                if (notifier){
                    notifier.close();
                    $.notify('Il server &egrave : <b>pronto</b><br>La comunicazione con il server ripristinata<br>Grazie allo staff di <b>Demalogic</b>.', {type : 'success'});
                }
            } else {
                notifier = $.notify('Il server &egrave nello stato di <b>' + status + '</b><br>tutta la comunicazione con il server &egrave; stata interrotta.<br>Ci scusiamo per l&apos;inconveniente ;)',{allow_dismiss : false, type : 'danger', delay : 0});
            }
        });
        window.ErrorManager = MANAGEERROR;
        var W2P_POST = function (resource, method, data, success, scope, options) {
            console.log('posting ' + resource + ' : ' + method);
            if ($rootScope.serverStatus != 'ready'){
                return $timeout(function(){
                    W2P_POST(resource,method,data,success,scope,options);
                },1000);
            } 
            if (!data) {
                data = {};
            } 
            data['sessionId'] = $rootScope.options.session_id;
            if (scope) {
                scope.waiting = true;
                //log('waiting to ' + scope.$id);
            }
            var url = base_url + $rootScope.options.application + '/plugin_angular/restful/' + resource + '/' + method;
            if (!options) {
                options = {headers: {'Content-Type': 'text/plain'}};
            } else if (!(options.headers)) {
                options.headers = {'Content-Type': 'text/plain'};
            } else if (!('Content-Type' in options.headers)) {
                options.headers['Content-Type'] = 'text/plain';
            }
            console.log('with options ' + JSON.stringify(data));
            return $http.post(url, data, options)
                .success(function (data, status, xhr, config) {
                    if (success) {
                        success.apply(this, [data, status, xhr, config]);
                        if (scope) {
                            scope.waiting = false;
                            //log('waiting false to ' + scope.$id);
                        }
                    }
                })
                .error(function (data, status) {
                    MANAGEERROR(data, status);
                    if (scope) {
                        scope.waiting = false;
                    }

                });
        };
        this.W2P_POST = W2P_POST;
        var W2PRESOURCE = this;
        var IDB = {auth_group: Lazy({})}; // tableName -> data as Array
        var IDX = {}; // tableName -> Lazy(indexBy('id')) -> IDB[data]
        var REVIDX = {}; // tableName -> fieldName -> Lazy.groupBy() -> IDB[DATA]
        var UNLINKED = {}; // table -> id_list
        var UNLINKED_MODELS = [];
        var UNLINKED_INDEX = {};
        var INDEX_UNLINKED = {};
        var INDEX_M2M = {};
        var MISSING_M2M = {};
        var ASKED_UNLINKED = {};
        var ASKED_M2M = {};
        var MISSING_PERMISSIONS = {};
        var GOT_ALL = Lazy([]);
        var LISTCACHE = {};
        var builderHandlers = {};
        var builderHandlerUsed = {};
        var eventHandlers = {};
        var MODEL_DATEFIELDS = {};
        var MODEL_BOOLFIELDS = {};
        var permissionWaiting = {};
        this.IDB = IDB;
        this.areAll = function (x) {
            return GOT_ALL.contains(x)
        };
        this.addBuilderHandler = function (modelName, decorator) {
            if (!(modelName in builderHandlers)) builderHandlers[modelName] = [];
            if (!(modelName in builderHandlerUsed)) builderHandlerUsed[modelName] = [];
            if (!Lazy(builderHandlers[modelName]).map(function (x) {
                    return x.toString();
                }).contains(decorator.toString())) {
                builderHandlers[modelName].push(decorator);
            }
            if (modelName in W2PRESOURCE.modelCache) {
                if (!Lazy(builderHandlerUsed[modelName]).map(function (x) {
                        return x.toString();
                    }).contains(decorator.toString())) {
                    decorator.apply(this, [W2PRESOURCE.modelCache[modelName]]);
                    builderHandlerUsed[modelName].push(decorator);
                }
            }
        };

        window.IDB = IDB;
        window.W2S = W2PRESOURCE;
        var getIndex = function (indexName) {
            if (indexName in IDB)
                return IDB[indexName];
            else {
                IDB[indexName] = Lazy({});
                return IDB[indexName];
            }
        };
        var getUnlinked = function (indexName) {
            if (indexName in UNLINKED)
                return UNLINKED[indexName];
            else {
                UNLINKED[indexName] = {};
                return UNLINKED[indexName];
            }
        };
        this.getIndex = getIndex;
        this.getUnlinked = getUnlinked;

        function PermissionTable(id, klass, permissions) {
            this.klass = klass;
            this.permissions = [];
            this.id = id;
            for (var k in permissions) {
                this.push.apply(this, [k, permissions[k]]);
            }
        }

        PermissionTable.prototype.save = function (cb) {
            var data = {
                permissions: Lazy(this.permissions).map(function (x) {
                    return [x[0].id, x[1]]
                }).toObject()
            };
            data.id = this.id;
            var modelName = this.klass._modelName;
            W2P_POST(this.klass._modelName, 'set_permissions', data, function (myPerms, a, b, req) {
                cb(myPerms);
            });
        };
        PermissionTable.prototype.push = function (group_id, permissionList) {
            var p = Lazy(permissionList);
            var perms = Lazy(this.klass._allPermissions).map(function (x) {
                return [x, p.contains(x)]
            }).toObject();
            var l = Lazy(this.permissions).map(function (x) {
                return x[0].id
            });
            if (l.contains(group_id))
                this.permissions[l.indexOf(group_id)][1] = perms;
            else
                this.permissions.push([IDB.auth_group.get(group_id), perms]);
        };
        $rootScope.PermissionTable = PermissionTable;

        var makeModelClass = function (model) {
            var _model = model;
            var fields = Lazy(model.fields);
            if (model.privateArgs) {
                fields = fields.merge(model.privateArgs);
            }
            var DATEFIELDS = fields.filter(function (x) {
                return (x.type == 'date') || (x.type == 'datetime')
            }).map(function (x, v) {
                return [v, true]
            }).toObject();
            var BOOLFIELDS = fields.filter(function (x) {
                return (x.type == 'boolean')
            }).map(function (x, v) {
                return [v, true]
            }).toObject();
            MODEL_DATEFIELDS[model.name] = DATEFIELDS;
            MODEL_BOOLFIELDS[model.name] = BOOLFIELDS;
            var Klass = function (row, permissions) {
                row = row || {};
                for (var x in Klass._fields) {
                    if (x in Klass._underscore) {
                        this['_' + x] = row[x];
                    } else if (x in DATEFIELDS) {
                        if (row[x]){
                            var d = new Date(row[x] * 1000);
                            this[x] = new Date(d - d.getTimezoneOffset())
                        } else {
                            this[x] = null;
                        }
                    } else if (x in BOOLFIELDS) {
                        this[x] = (row[x] == 'T') || (row[x] == true);
                    } else {
                        this[x] = row[x];
                    }
                };
                if (permissions) {
                    this._permissions = permissions && Lazy(permissions).map(function (x) {
                            return [x, true]
                        }).toObject();
                }
                if (W2S.modelCache[this.constructor.name]._builderHandlers.length) {
                    var t = this;
                    Lazy(this.constructor._builderHandlers).each(function (handler) {
                        handler.apply(t)
                    });
                }
            };
            var Klass = renameFunction(model.name,Klass);
            Klass._builderHandlers = [];
            Klass.addBuilderHandler = function (decorator) {
                if (Lazy(Klass._builderHandlers).contains(decorator)) return;
                Klass._builderHandlers.push(decorator);
            };
            Klass._ref_translations = {};
            Klass._modelName = model.name;
            Klass._represent_fields = model.representation;
            Klass._references = model.references.map(function (x) {
                return x.id
            });
            Klass._underscore = Lazy(Klass._references).map(function (x) {
                return [x, true];
            }).toObject();
            Klass._inverse_references = model.referencedBy.map(function (x) {
                return x.by + '_' + x.id + '_set'
            });
            Klass._referents = model.referencedBy.map(function (x) {
                return [x.by, x.id]
            });
            Klass._fieldsOrder = model.fieldOrder;
            Klass._allPermissions = model.permissions;
            Klass.prototype.toString = function () {
                var vals = [];
                for (f in this.constructor._represent_fields) {
                    vals.push(this[this.constructor._represent_fields[f]]);
                }
                return vals.join(' ');
            };
            Klass.prototype.toUpperCase = function () {
                return this.toString().toUpperCase();
            };
            Klass.prototype.toLowerCase = function () {
                return this.toString().toLowerCase();
            };
            Klass.prototype.delete = function (scope) {
                W2PRESOURCE.del(this.constructor._modelName, this.id, scope);
            };
            Object.defineProperty(Klass.prototype, 'permissions', {
                get: function () {
                    if (this._permissions)
                        return this._permissions;
                    else {
                        MISSING_PERMISSIONS[this.constructor._modelName].push(this.id);
                    }
                }
            });
            MISSING_PERMISSIONS[Klass._modelName] = [];
            Klass.prototype.all_perms = function (cb) {
                var object_id = this.id;
                W2P_POST(this.constructor._modelName, 'all_perms', {id: this.id}, function (data) {
                    var permissions = data;
                    var grouped = {};
                    var unknown_groups = Lazy(permissions).pluck('group_id').unique().map(function (x) {
                        return '' + x
                    }).difference(IDB.auth_group.keys()).toArray();
                    Lazy(permissions).groupBy(function (x) {
                        return x.group_id
                    }).each(function (v, k) {
                        grouped[k] = Lazy(v).pluck('name').toArray()
                    });
                    var call = function (x) {
                        cb(new PermissionTable(object_id, Klass, grouped));
                    };
                    if (unknown_groups.length)
                        W2PRESOURCE.get('auth_group', unknown_groups, undefined, call);
                    else
                        call();
                });
            };
            Klass.prototype.save = function (args) {
                if (args) {
                    for (var arg in args) {
                        this[arg] = args[arg];
                    }
                }
                var obj = {};
                var o = this.asRaw();
                var fieldOrder = this.field;
                Lazy(this.constructor._fields).each(function (x) {
                    var PA = Klass._privateArgs || {};
                    if ((x.type != 'M2M') && x.writable && (!(x.id in PA)))
                        obj[x.id] = o[x.id];
                });
                W2PRESOURCE[this.id ? 'post' : 'put'](this.constructor._modelName, obj);
            };
            Klass.prototype.copy = function () {
                var obj = new this.constructor(this.asRaw());
                obj._permissions = this._permissions;
                return obj;
            };
            Klass.prototype.asRaw = function () {
                var o = this;
                var underscore = Klass._underscore;
                return Lazy(Klass._fields).map(function (v, k) {
                    if (k in underscore) {
                        return [k, o['_' + k]];
                    }
                    if (k in DATEFIELDS) {
                        if (o[k]) {
                            return [k, (Math.round(o[k].getTime() - o[k].getTimezoneOffset() * 60000) / 1000)];
                        } else {
                            return [k, null];
                        }
                    }
                    return [k, o[k]];
                })
                    .toObject();
            };
            Klass.saveMulti = function (objects, cb, scope) {
                var raw = [];
                var deletable = Lazy(Klass._fields)
                    .filter(function (x) {
                        return !x.writable
                    })
                    .pluck('id')
                    .toArray();
                Lazy(objects)
                    .map(function (x) {
                        return x.asRaw()
                    })
                    .each(function (x) {
                        Lazy(deletable).each(function (y) {
                            delete x[y];
                        });
                        raw.push(x);
                    });
                W2P_POST(Klass._modelName, 'put', {multiple: raw, formIdx : W2PRESOURCE.formIdx++}, function (elems) {
                    W2PRESOURCE.gotData(elems);
                    var tab = IDB[Klass._modelName];
                    var objs = Lazy(elems[Klass._modelName].results).pluck('id').map(function (x) {
                        return tab.get(x)
                    }).toArray();
                    if (cb) {
                        cb(objs);
                    }
                }, scope);
            };
            if ('extra_verbs' in model)
                Lazy(model.extra_verbs).each(function (x) {
                    var funcName = x[0];
                    var args = x[1];
                    var ddata = 'data = {id : this.id';
                    if (args.length)
                        ddata += ', ' + Lazy(args).map(function (x) {
                                return x + ' : ' + x;
                            }).join(',');
                    ddata += '};';
                    args.push('cb');
                    Klass.prototype[funcName] = new Function(args, ddata + 'W2S.W2P_POST(this.constructor._modelName,"' + funcName + '", data,function(data,status,headers,x){' +
                        'try{\n' +
                        '   if (!headers("nomodel")) {window.W2S.gotData(data,cb);}\n' +
                        '   else {if (cb) {cb(data)}}\n' +
                        '} catch(e){\n' +
                        'if (cb) {cb(data);}\n' +
                        '}\n' +
                        '});\n'
                    );
                });

            if ('privateArgs' in model) {
                Klass._privateArgs = Lazy(model.privateArgs).keys().map(function (x) {
                    return [x, true];
                }).toObject();
                Klass.prototype.savePA = function (o) {
                    var T = this;
                    var oo = {id: this.id};
                    var PA = this.constructor._privateArgs;
                    var Fs = this.constructor._fields;
                    var t = new this.constructor(o).asRaw();
                    var fieldIdx = Lazy(PA).keys().map(function (x) {
                        return [x, Fs[x]]
                    }).toObject();
                    Lazy(o).each(function (v, k) {
                        if ((k in PA) && fieldIdx[k].writable) {
                            oo[k] = v;
                        }
                    });
                    W2PRESOURCE.W2P_POST(this.constructor._modelName, 'savePA', oo, function () {
                        Lazy(oo).each(function (v, k) {
                            T[k] = v;
                        });
                    });
                };
            }

            W2PRESOURCE.modelCache[Klass._modelName] = Klass;
            // adding id to fields
            for (var f in model.fields) {
                model.fields[f].id = f;
            }
            Klass._fields = Lazy(model.fields).concat(Lazy(model.privateArgs)).concat(Lazy(model.references).tap(function (x) {
                x.type = x.type || 'reference'
            })).indexBy('id').toObject();
            // building references to (many to one) fields
            Lazy(model.references).each(function (ref) {
                var ext_ref = ref.to;
                var local_ref = '_' + ref.id;
                Object.defineProperty(Klass.prototype, ref.id, {
                    get: function () {
                        try {
                            if (local_ref) {
                                var result = this[local_ref] && IDB[ext_ref].get(this[local_ref]);
                                if (!result) {
                                    if (this[local_ref] && !(IDB[ext_ref].contains(this[local_ref]))) {
                                        throw ('ciao');
                                    }
                                }
                            }
                            return result;
                        } catch (e) {
                            var modName = ext_ref;
                            if (!(modName in UNLINKED)) {
                                UNLINKED[modName] = {};
                            }
                            UNLINKED[modName][this[local_ref]] = true;
                            return undefined;
                        }
                    },
                    set: function (value) {
                        if (value) {
                            if (value.constructor._modelName != ext_ref) {
                                throw new TypeError('You can assign only ' + ext_ref + ' to ' + ref.id);
                            }
                        }
                        this[local_ref] = value.id;
                    }
                });
                ASKED_UNLINKED[ext_ref] = {};
                Klass.prototype['get' + capitalize(ref.id)] = function (callBack) {
                    return W2PRESOURCE.getCached(ext_ref, [this[local_ref]], null, function (x) {
                        callBack(x && x[0]);
                    });
                };
            });

            //building references to (one to many) fields
            Lazy(model.referencedBy).each(function (ref) {
                var indexName = ref.by + '_' + ref.id;
                if (Klass.prototype.hasOwnProperty(indexName + '_set')) {
                    $log.error('Tryed to redefine property ' + indexName + '_set' + ' for ' + Klass._modelName);
                } else {
                    Object.defineProperty(Klass.prototype, indexName + '_set', {
                        get: function () {
                            try {
                                var ret = REVIDX[indexName].get(this.id + '');
                                if (!ASKED_UNLINKED[indexName].contains(this.id))
                                    UNLINKED_INDEX[indexName][this.id] = true;
                                if (ret) return ret;
                            } catch (e) {
                                if (!(indexName in UNLINKED_INDEX)) {
                                    UNLINKED_INDEX[indexName] = {};
                                }
                                if (!ASKED_UNLINKED[indexName].contains(this.id))
                                    UNLINKED_INDEX[indexName][this.id] = true;
                            }
                        }
                    });
                }
                Klass.prototype['get' + capitalize(ref.by) + 's'] = function (callBack) {
                    var ID = this.id + '';
                    W2PRESOURCE.describe(ref.by, function (omodel) {
                        if (!(indexName in REVIDX)) REVIDX[indexName] = Lazy({});
                        var ret = REVIDX[indexName].get(ID);
                        if (ret)
                            callBack(ret);
                        else {
                            W2PRESOURCE.linking.source[indexName] = 1;
                            var filter = {};
                            filter[ref.id] = [ID];
                            W2PRESOURCE.list(ref.by, {filter: filter}, null, function (objs) {
                                if (objs.length) {
                                    if (!(indexName in ASKED_UNLINKED)) ASKED_UNLINKED = Lazy([]);
                                    ASKED_UNLINKED[indexName].source.push(ID);
                                    callBack(objs);
                                } else {
                                    callBack([]);
                                }
                                W2PRESOURCE.linking.source[indexName] = 0;
                            });
                        }
                    });
                };

                INDEX_UNLINKED[indexName] = ref;
                if (!(indexName in ASKED_UNLINKED))
                    ASKED_UNLINKED[indexName] = Lazy([]);
            });

            //building reference to (many to many) fields
            if (model.manyToMany) {
                Lazy(model.manyToMany).each(function (ref) {
                    var indexName = ref.indexName;
                    var first = ref.first ? 0 : 1;
                    var omodelName = ref.model;
                    var omodel = getIndex(omodelName);
                    Object.defineProperty(Klass.prototype, ref.model + 's', {
                        get: function () {
                            var ID = this.id;
                            //try {
                            var references = INDEX_M2M[indexName][first].get(ID);
                            if (!(ID in ASKED_M2M[indexName][first]))
                                MISSING_M2M[indexName][first][ID] = true;
                            if (references && references.length) {
                                var ret = Lazy(references).map(function (x) {
                                    return omodel.get(x)
                                }).filter(function (x) {
                                    return x
                                }).toArray();
                                if (ret.length) {
                                    return ret;
                                } else {
                                    var ix = Lazy(ret).indexBy('id');
                                    if (!(omodelName in UNLINKED)) {
                                        UNLINKED[omodelName] = {};
                                    }
                                    Lazy(references).filter(function (x) {
                                        return !ix.contains(x)
                                    }).each(function (x) {
                                        UNLINKED[omodelName][x] = true;
                                    });
                                }
                            }
                            //else {throw ('');}
                            //} catch (e){}
                        }
                    });
                    if (!(indexName in INDEX_M2M)) {
                        INDEX_M2M[indexName] = [Lazy({}), Lazy({})];
                    }
                    if (!(indexName in MISSING_M2M)) {
                        MISSING_M2M[indexName] = [{}, {}];
                    }
                    if (!(indexName in ASKED_M2M)) {
                        ASKED_M2M[indexName] = [{}, {}];
                    }
                    Klass.prototype['get' + capitalize(omodelName) + 's'] = function (cb, scope) {
                        /*
                         var gotRels = function(list,cb){
                         ASKED_M2M[indexName][first][ID] = 1;
                         //console.log('gotRels',list);
                         INDEX_M2M[indexName][first].source[ID] = list;
                         if (list) {
                         if (!(omodelName in IDB)) {
                         IDB[omodelName] = Lazy({});
                         }
                         var idx = IDB[omodelName];
                         var missing = Lazy(list).filter(function (x) {
                         return !idx.keys().contains(x)
                         }).toArray();
                         if (missing.length) {
                         W2PRESOURCE.getCached(omodelName, missing, scope, function (x) {
                         cb(Lazy(list).map(function (x) {
                         return idx.get(x)
                         }).toArray());
                         })
                         } else {
                         cb(Lazy(list).map(function (x) {
                         return idx.get(x)
                         }).toArray());
                         }
                         } else {
                         cb([]);
                         }
                         };
                         */
                        var ID = this.id;
                        if ((indexName in ASKED_M2M) && ASKED_M2M[indexName][first][ID]) {
                            var iTab = (omodelName in IDB) ? IDB[omodelName] : Lazy({});
                            var objects = Lazy(INDEX_M2M[indexName][first].get(ID))
                                .map(function (x) {
                                    return iTab.get(x)
                                }).toArray();
                            cb(objects);
//                            cb(INDEX_M2M[indexName][first].get(ID),cb);
                        } else {
                            W2P_POST(Klass._modelName, omodelName + 's/list', {collection: [this.id]}, function (list) {
                                ASKED_M2M[indexName][first][ID] = 1;
                                W2PRESOURCE.gotM2M(list.m2m, cb);
                                /*                                W2PRESOURCE.gotM2M(list.m2m,function(x){
                                 gotRels(INDEX_M2M[indexName][first].get(ID),cb);
                                 })
                                 */
                            }, scope);
                        }
                    };
                    Klass._fields[capitalize(omodelName)] = {
                        id: omodelName + 's',
                        name: capitalize(omodelName),
                        writable: true,
                        readable: true,
                        type: 'M2M',
                        validators: []
                    };

                });
                Klass.prototype.unlinkReference = function (instance) {
                    var multiple = false;
                    var ID = this.id;
                    var instances = [];
                    if (instance.constructor.name == 'Array') {
                        multiple = true;
                        instances = instance;
                        instance = instances[0];
                    }
                    var omodel = instance.constructor._modelName;
                    if (multiple) {
                        var collection = Lazy(instances).pluck('id').map(function (x) {
                            return [ID, x]
                        }).toArray();
                    } else {
                        var collection = [[ID, instance.id]];
                    }
                    W2P_POST(Klass._modelName, omodel + 's/delete', {collection: collection}, function (data) {
                    });
                };
                Klass.prototype.linkReference = function (instance) {
                    var multiple = false;
                    var ID = this.id;
                    var instances = [];
                    if (instance.constructor.name == 'Array') {
                        multiple = true;
                        instances = instance;
                        instance = instances[0];
                    }
                    var omodel = instance.constructor._modelName;
                    var indexName = Klass._modelName + '/' + omodel;
                    if (multiple) {
                        var refs = [];
                        if (indexName in INDEX_M2M) {
                            refs = Lazy(instances).pluck('id').difference(Lazy(INDEX_M2M[indexName][0].get(this.id))).toArray();
                        }
                        indexName = omodel + '/' + Klass._modelName;
                        if (indexName in INDEX_M2M) {
                            refs = Lazy(instances).pluck('id').difference(Lazy(INDEX_M2M[indexName][0].get(this.id))).toArray();
                        }
                        if (refs.length) {
                            var collection = Lazy(refs).map(function (x) {
                                return [ID, x]
                            }).toArray();
                            W2P_POST(Klass._modelName, omodel + 's/put', {collection: collection}, function (data) {
                            });
                        }
                    } else {
                        if ((indexName in INDEX_M2M) && Lazy(INDEX_M2M[indexName][0].get(this.id)).contains(instance.id)) {
                            return;
                        }
                        indexName = omodel + '/' + Klass._modelName;
                        if ((indexName in INDEX_M2M) && Lazy(INDEX_M2M[indexName][0].get(this.id)).contains(instance.id)) {
                            return;
                        }
                        W2P_POST(Klass._modelName, omodel + 's/put', {collection: [[this.id, instance.id]]}, function (data) {
                        });
                    }
                };
            }
            /* model handlers */
            if (Klass._modelName in builderHandlers) {
                while (builderHandlers[Klass._modelName].length) {
                    var handler = builderHandlers[Klass._modelName].pop();
                    if (!Lazy(builderHandlerUsed[Klass._modelName]).map(function (x) {
                            return x.toString();
                        }).contains(handler.toString())) {
                        handler(Klass);
                        builderHandlerUsed[Klass._modelName].push(handler);
                    }
                }
                //Lazy(builderHandlers[Klass._modelName]).each(function(handler){return handler(Klass)});
            }

            // adding direct references as normal fields
            //for (var f in model.references){
            //    var field = model.references[f];
            //    field.type = 'reference';
            //    Klass._fields[field.id] = field;
            //}
            //
            //log('class ' + Klass._modelName + ' e rappresentata da ' + Klass._represent_fields.join(' '));
            //
            //for (var ref in _model.references) {
            //    ref = _model.references[ref];
            //    //var ext_ref = '_' + ref.id;
            //    var local_ref = ref.id;
            //    log('inking getter for ' + ref.id + ' to ' + model.name);
            //
            //    ref.klass = Klass;
            //
            //    UNLINKED_MODELS.push(ref);
            //}
            //// looking for unlinked models
            //for (m in UNLINKED_MODELS){
            //    ref = UNLINKED_MODELS[m];
            //    log('retry to link from ' + ref.klass._modelName + ' to ' + ref.to);
            //    if (ref.to in W2PRESOURCE.modelCache){
            //        linkModel(ref);
            //        // unmark model to be linked
            //        idx = $.inArray(UNLINKED_MODELS,ref);
            //        if (idx != -1)
            //            UNLINKED_MODELS.splice(idx,1);
            //    }
            //}


            $rootScope.$broadcast('built-' + Klass._modelName, Klass);
            return Klass;
        };

        W2PRESOURCE.modelCache = {}; // models descriptions
        W2PRESOURCE.httpCache = {};

        this.descriptionCache = {};
        /*        this.decodeFields = function(fields){
         var f;
         for (var f in fields) {
         field = fields[f];
         if (field.cardinality){
         cardinality = field.cardinality;
         log(field);
         tableName = (cardinality=='single')?f.slice(1):f;
         W2PRESOURCE.descriptionCache[tableName] = field;
         nested = {type : (cardinality=='single')?'reference ' + tableName:'referencedBy ' + tableName};
         nested.fields = W2PRESOURCE.decodeFields(field.fields);
         nested.id = (cardinality=='single')?f:tableName + '_set';
         try {
         W2PRESOURCE.descriptionCache[tableName]['cardinality'];
         } catch (e) {}
         log(f);
         fields[f] = nested;
         }
         if (field.type.slice(0, 9) == 'reference') {
         field.reference = field.type.slice(10);
         field.type = 'reference';
         // decoding python format %(<field_name>)s expression
         ref_table_fields = field.validators.reference;
         regex = /\%\((\S+)\)\w/
         if (regex.test(ref_table_fields)) {
         referenced_fields = [];
         i = 0;
         while (regex.test(ref_table_fields.slice(i))) {
         found = regex.exec(ref_table_fields.slice(i))[1];
         referenced_fields.push(found);
         i += found.length + 4;
         }
         field.ref_fields = referenced_fields;
         } else {
         field.ref_fields = [ref_table_fields];
         }
         //field.represent = function (field, item) {
         //    ret = [];
         //    for (ff in field.ref_fields) {
         //        ret.push(item[field.ref_fields[ff]]);
         //    }
         //    return ret.join(' ');
         //}
         }
         }
         return fields;
         };
         */
        this.describe = function (resourceName, callBack) {    // direct callback
            var gotModel = function (data) {
                for (var modelName in data) {
                    var model = data[modelName];
                    localStorage['description:' + modelName] = angular.toJson(data);
                    W2PRESOURCE.modelCache[resourceName] = makeModelClass(model);
                    if (!(resourceName in IDB)) {
                        IDB[resourceName] = Lazy({});
                    }
                }
                W2PRESOURCE.describe(resourceName, callBack);
            };
            var ret = W2PRESOURCE.modelCache[resourceName];
            if (ret) {
                callBack && callBack.apply(this, [ret]);
            } else {
                var cacheKey = 'description:' + resourceName;
                if (cacheKey in localStorage) {
                    gotModel(angular.fromJson(localStorage[cacheKey]));
                } else {
                    W2P_POST(resourceName, 'describe', {}, gotModel, null, {cache: W2PRESOURCE.httpCache});
                }
            }
        };
        this.list = function (resourceName, options, scope, callBack) {  //
            if (!(resourceName in W2PRESOURCE.modelCache)) {
                return W2PRESOURCE.describe(resourceName, function () {
                    W2PRESOURCE.list(resourceName, options, scope, callBack);
                });
            }
            if (GOT_ALL.contains(resourceName)) {
                var data = {};
                data[resourceName] = {totalResults: 0, results: []};
                W2PRESOURCE.gotData(data, callBack);
            } else {
                if ($rootScope.realtime) {
                    if (!(resourceName in LISTCACHE))
                        LISTCACHE[resourceName] = {};
                    var listCache = LISTCACHE[resourceName];
                    var jOpts = angular.toJson(Lazy(options).filter(function (x, y) {
                        return y != 'together';
                    }).toObject());
                    if (callBack && ('filter' in options)) {
                        //var filter = options.filter;
                        //filter = $parse(attrs.filter)(scope);
                        //var filterItems = function(x){
                        //    return Lazy(filter).all(function(v,k){return x[k] == v});
                        //};
                        var filterItems = makeFilter(W2PRESOURCE.modelCache[resourceName], options.filter);
                    }
                    if (jOpts in listCache) {
                        $rootScope.$broadcast('arrived-' + resourceName);
                        if (callBack) {
                            var opts = angular.fromJson(jOpts);
                            if ('filter' in opts) {
                                /*
                                 var filter = options.filter;
                                 //filter = $parse(attrs.filter)(scope);
                                 var filterItems = function(x){
                                 return Lazy(filter).all(function(v,k){return x[k] == v});
                                 };
                                 */
                                var objects = IDB[resourceName].values().filter(filterItems).toArray();
                                callBack(objects);
                            } else {
                                callBack(IDB[resourceName].values().toArray());
                            }
                        }
                    } else {
                        W2P_POST(resourceName, 'list', options, function (data) {
                            listCache[jOpts] = true;
                            W2PRESOURCE.gotData(data);
                            /*
                             var filterItems = function(x){
                             return Lazy(filter).all(function(v,k){return x[k] == v});
                             };
                             */
                            var objects = IDB[resourceName].values().filter(filterItems).toArray();
                            callBack(objects);
                        }, scope);
                    }
                } else {
                    W2P_POST(resourceName, 'list', options, function (data) {
                        if (!('filter' in options)) {
                            GOT_ALL.source.push(resourceName);
                        }
                        W2PRESOURCE.gotData(data, function(data){
                            var objects = IDB[resourceName].values().filter(filterItems).toArray();
                            callBack(objects);
                        });
                    }, scope);
                }
            }
        };
        this.put = function (resourceName, item, callBack, scope) {
            return W2P_POST(resourceName, 'put', item, function (data) {
                W2PRESOURCE.gotData(data);
                if (callBack) {
                    callBack(data);
                }
            }, scope);
        };
        this.post = function (resourceName, item, callBack, scope) {
            return W2P_POST(resourceName, 'post', item, function (data) {
                W2PRESOURCE.gotData(data);
                if (callBack) {
                    callBack(data);
                }
            }, scope);
        };
        this.get = function (resourceName, ids, scope, callBack) {
            return W2PRESOURCE.list(resourceName, {filter: {id: ids}}, scope, callBack);
            //return W2P_POST(resourceName,'get',{ids : ids},function(data) {
            //    W2PRESOURCE.gotData(data,callBack);
            //}, scope);
        };
        this.del = function (resourceName, id, scope) {
            var url = 'delete/' + id;
            var data = {};
            if (Array.isArray(id)) {
                url = 'delete';
                data = {id: id};
            }
            W2P_POST(resourceName, url, data, function (data) {
                W2PRESOURCE.gotData(data);
                //
                //$rootScope.$broadcast('deleted-' + resourceName, [id]);
                //// removing crossing references
                //delete IDB[resourceName].source[id];

            }, scope);
        };
        this.custom = W2P_POST;
        this.refresh = function (tab) {
            if (tab) {
                $rootScope.$broadcast('items-' + tab, getValues(IDB[tab]));
            } else {
                for (tab in IDB) {
                    W2PRESOURCE.refresh(tab)
                }
            }
        };
        this.gotM2M = function (m2m, cb) {
            Lazy(m2m).each(function (verbs, indexName) {
                var first = parseInt(indexName.split('|')[1]);
                var second = 1 - first;
                indexName = indexName.split('|')[0];
                var resourceName = indexName.split('/')[second];
                var missing = [];
//                var unlinked = UNLINKED[resourceName];
                var requested = [];
                var iTab = (resourceName in IDB) ? IDB[resourceName] : Lazy({});
                Lazy(verbs).each(function (verb) {
                    if (!(indexName in INDEX_M2M)) {
                        INDEX_M2M[indexName] = [Lazy({}), Lazy({})]
                    }
                    var I1 = INDEX_M2M[indexName][0].source;
                    var I2 = INDEX_M2M[indexName][1].source;
                    if (verb.add) {
                        var x = verb.add;
                        if (!(x[0] in I1)) {
                            I1[x[0]] = [];
                        }
                        if (!(x[1] in I2)) {
                            I2[x[1]] = [];
                        }
                        I1[x[0]] = Lazy(I1[x[0]]).union([x[1]]).toArray();
                        I2[x[1]] = Lazy(I2[x[1]]).union([x[0]]).toArray();
                        if (isFinite(second) && !(x[second] in iTab.source)) {
                            missing.push(x[second]);
                        }
                        requested.push(x[second]);
                    } else if (verb.del) {
                        var x = verb.del;
                        var ix = Lazy(I1[x[0]]).indexOf(x[1]);
                        if (ix >= 0) I1[x[0]].splice(ix, 1);
                        ix = Lazy(I2[x[1]]).indexOf(x[0]);
                        if (ix >= 0) I2[x[1]].splice(ix, 1);
                    }
                    Lazy(indexName.split('/')).each(function (x) {
                        $rootScope.$broadcast('m2m-' + x);
                    });
                });
                if (missing.length) {
                    W2PRESOURCE.getCached(resourceName, requested, null, cb);
                }
                else {
                    cb && cb(Lazy(requested).map(function (x) {
                        return iTab.get(x);
                    }).toArray());
                }
                W2PRESOURCE.linking.source[indexName + first] = 0;
            });
        };
        this.gotData = function (data, callBack) {
            if (typeof(data) == 'string') {
                log('data ' + data + ' refused from gotData()');
                if (callBack) {
                    return callBack(data);
                }
                return;
            }
            data = Lazy(data).filter(function (y, x) {
                return x != '_extra'
            }).toObject();
            var _callStack = Lazy(data).keys().toArray();   //  concluded.
            var completed = function (modelName) {
                /*
                 _callStack.splice(Lazy(_callStack).indexOf(modelName),1);
                 if (_callStack.length) return;
                 if (callBack){
                 callBack.apply(this,[data]);
                 }
                 */
            };
            var TOONE = data.TOONE;
            var TOMANY = data.TOMANY;
            var MANYTOMANY = data.MANYTOMANY;
            var PERMISSIONS = data.PERMISSIONS;
            var PA = data.PA;
            delete data.TOONE;
            delete data.TOMANY;
            delete data.MANYTOMANY;
            delete data.PERMISSIONS;
            delete data.PA;
            if (!PA) {
                PA = {};
            }
            data = Lazy(data).filter(function (v, k) {
                return (!('deleted' in v) || ((k in W2PRESOURCE.modelCache)));
            }).toObject();
            if ('m2m' in data) {
                var m2m = data.m2m;
                delete data['m2m'];
            }
            Lazy(data).each(function (data, modelName) {
                W2PRESOURCE.describe(modelName, function (fields, representation, field_aggregations) {
                    var modelClass = W2PRESOURCE.modelCache[modelName];
                    if (data.results && (data.results.length > 0) && (data.results[0].constructor == Array)) {
                        data.results = Lazy(data.results).map(function(x){ 
                            return Lazy(modelClass._fieldsOrder).zip(x).toObject() 
                        }).toArray();
                    }
                    var results = Lazy(data.results);
                    var deleted = data.deleted;
                    if (modelName in PA) {
                        var MPA = PA[modelName];
                        Lazy(results).each(function (record) {
                            if (record.id in MPA) {
                                Lazy(MPA[record.id]).each(function (v, k) {
                                    record[k] = v;
                                });
                            }
                        })
                    }

                    // indexing references by its ID
                    if (!(modelName in IDB))
                        IDB[modelName] = Lazy({});
                    var itab = IDB[modelName];
                    var table = itab.source;

                    // object deletion
                    Lazy(deleted).each(function (x) {
                        delete table[x];
                    });

                    var idx = results.indexBy('id');
                    var ik = idx.keys();
                    var nnew = ik.difference(itab.keys().map(function (x) {
                        return parseInt(x)
                    }));
                    var updated = ik.difference(nnew);
                    // removing old identical values
                    updated = updated.filter(function (x) {
                        return !sameAs(idx.get(x), itab.get(x).asRaw());
                    });
                    // classify records
                    var perms = data.permissions ? Lazy(data.permissions) : Lazy({});
                    var newObjects = nnew.map(function (x) {
                        return new modelClass(idx.get(x), perms.get(x))
                    });

                    //// classifying updated
                    //var updatedObjects = updated.map(function(x){return new modelClass(idx.get(x),perms.get(x))});
                    //var uo = updatedObjects.toArray();
                    //updatedObjects = Lazy(uo).map(function(x){return [x,table[x.id]]}).toArray();
                    // Updating single objects
                    var changed = [];
                    var DATEFIELDS = MODEL_DATEFIELDS[modelName];
                    var BOOLFIELDS = MODEL_BOOLFIELDS[modelName];
                    updated.each(function (x) {
                        var oldItem = itab.get(x);
                        var oldCopy = oldItem.copy();
                        var underscore = modelClass._underscore;
                        //for (attr in newItem){
                        //    oldCopy[attr] = oldItem[attr];
                        //}
                        var newItem = idx.get(x);
                        for (var attr in newItem) {
                            if (attr in DATEFIELDS) {
                                oldItem[attr] = new Date(newItem[attr] * 1000);
                            } else if (attr in BOOLFIELDS) {
                                oldItem[attr] = newItem[attr] == 'T';
                            } else if (attr in underscore) {
                                oldItem['_' + attr] = newItem[attr];
                            } else {
                                oldItem[attr] = newItem[attr];
                            }
                        }
                        changed.push([oldItem, oldCopy]);
                    });

                    //// sending signal for updated values
                    if (changed.length) {
                        $rootScope.$broadcast('updated-' + modelName, changed);
                    }
                    //******** Update universe ********
                    var no = newObjects.toArray();
                    Lazy(no).each(function (x) {
                        table[x.id] = x
                    });
                    // rebulding reverse indexes
                    Lazy(W2PRESOURCE.modelCache[modelName]._references).map(function (x) {
                        return '_' + x;
                    }).each(function (ref) {
                        if (!((modelName + ref) in REVIDX)) {
                        }
                        REVIDX[modelName + ref] = IDB[modelName].groupBy(function (x) {
                            return x[ref]
                        });
                    });
                    // sending signal for new values
                    if (no.length)
                        $rootScope.$broadcast('new-' + modelName, Lazy(no), data.totalResults);
                    if (deleted) {
                        $rootScope.$broadcast('deleted-' + modelName, deleted);
                    }
                    // sending signal for data arrived
                    $rootScope.$broadcast('arrived-' + modelName);
                    completed(modelName);
                });
            });
            if (TOONE) {
                Lazy(TOONE).each(function (vals, modelName) {
                    console.log(modelName);
                    var udx = getUnlinked(modelName);
                });
            }
            if (TOMANY) {
                Lazy(TOMANY).each(function (vals, indexName) {
                    if (!(indexName in ASKED_UNLINKED)) {
                        ASKED_UNLINKED[indexName] = Lazy([]);
                    }
                    Lazy(vals).each(function (id) {
                        ASKED_UNLINKED[indexName].source.push(id);
                    });
                });
            }
            if (MANYTOMANY) {
                Lazy(MANYTOMANY).each(function (vals, indexName) {
                    var first = parseInt(indexName.split('|')[1]);
                    indexName = indexName.split('|')[0];
                    if (!(indexName in ASKED_M2M)) {
                        ASKED_M2M[indexName] = [{}, {}];
                    }
                    var MIDX = ASKED_M2M[indexName][first];
                    Lazy(vals).each(function (x) {
                        MIDX[x + ''] = true;
                        MIDX[x] = true;
                    });
                });
            }
            if (m2m) {
                W2PRESOURCE.gotM2M(m2m);
            }
            if (PERMISSIONS) {
                W2PRESOURCE.gotPermissions(PERMISSIONS);
            }

            if (callBack) {
                callBack(data);
            }
            $timeout(function () {
            });
        };
        this.linking = Lazy({});
        this.wait_for_permissions = false;
        this.gotPermissions = function (data) {
            Lazy(data).each(function (v, resourceName) {
                Lazy(v[0]).each(function (row, id) {
                    if ((resourceName in IDB) && (id in IDB[resourceName].source))
                        IDB[resourceName].get(id)._permissions = Lazy(row).map(function (x) {
                            return [x, true]
                        }).toObject();
                    MISSING_PERMISSIONS[resourceName] = Lazy(MISSING_PERMISSIONS[resourceName]).unique().filter(function (x) {
                        return x != id;
                    }).toArray();
                })
            });
        };
        this.linkUnlinked = function () {
            // performe a DataBase synchronization with server looking for unknown data
            $rootScope.linking = W2PRESOURCE.linking.filter(function(v,k){return v}).map(function(v,k){return k}).toArray();
            if (W2PRESOURCE.linking.sum()) return;
            var changed = false;
            Lazy(MISSING_M2M).each(function (indexes, indexName) {
                if (W2PRESOURCE.linking.get('m2m')) {
                    return;
                }
                var n = 100;
                Lazy(indexes).filter(function (x, m) {
                    n = m;
                    return !Lazy(x).isEmpty()
                }).each(function (idx) {
                    var collection = Lazy(idx).keys().difference(Lazy(ASKED_M2M[indexName][n]).keys()).toArray();
                    var INDEX = INDEX_M2M[indexName];
                    if (collection.length) {
                        changed = true;
                        collection = Lazy(collection).filter(function (x) {
                            return x
                        }).map(function (x) {
                            return parseInt(x)
                        }).toArray();
                        W2PRESOURCE.linking.source[indexName + n] = 1;
                        Lazy(collection).each(function (x) {
                            ASKED_M2M[indexName][n][x] = true;
                            delete MISSING_M2M[indexName][n][x];
                        });
                        W2P_POST((n ? reverse('/', indexName) : indexName) + 's', 'list', {collection: collection}, function (data, status, xhr, config) {
                            W2PRESOURCE.gotM2M(data.m2m);
                            /*
                             var DATA = data;
                             var u = Lazy(config.url).split('/');
                             var l = u.size();
                             var iName = u.get(l - 3) + '/' + u.get(l - 2).slice(0,-1);
                             if (iName in INDEX_M2M){
                             var n = 0;
                             } else {
                             var n = 1;
                             }
                             W2PRESOURCE.linking.source[indexName + n] = 0;
                             Lazy(data.m2m).each(function(data,iName){
                             data = data.add;
                             var INDEX = INDEX_M2M[indexName];
                             var odx = indexName.split('/')[1 - n];
                             var dbGot = getIndex(odx);
                             var udx = getUnlinked(odx);
                             //Lazy(data).each(function(v,k){
                             //    if (!INDEX[n].contains(k)){INDEX[n].source[k] = Lazy([]);}
                             //    INDEX[n].source[k] = INDEX[n].get(k).union(v).toArray();

                             //});
                             W2PRESOURCE.gotData(DATA);
                             //if (data){
                             //    var gotData = Lazy(data).values().flatten().unique();
                             //    gotData.difference(dbGot.keys()).each(function(x){udx[x] = true;});
                             //    Lazy(indexName.split('/')).each(function(x){$rootScope.$broadcast('m2m-' + x)});
                             //}
                             });
                             */
                        });
                    }
                });
            });
            Lazy(UNLINKED).each(function (ids, modelName) {
                changed = true;
                var idb = modelName in IDB ? IDB[modelName].keys() : Lazy();
                delete ids.null;
                ids = Lazy(ids).keys().toArray();
                // Lazy(ids).keys().filter(function(x){return x != 'null' && !idb.contains(x)}).map(parseInt).toArray();
                if (ids.length) {
                    W2PRESOURCE.linking.source[modelName] = 1;
                    //log('linking.' + modelName + ' = ' + W2PRESOURCE.linking.source[modelName]);
                    W2PRESOURCE.list(modelName, {filter: {id: ids}}, undefined, function (data) {
                        W2PRESOURCE.linking.source[modelName] = 0;
                        //log('linking.' + modelName +
                        // ' = ' + W2PRESOURCE.linking.source[modelName]);
                    });
                }
                delete UNLINKED[modelName];
            });
            Lazy(UNLINKED_INDEX).filter(function (x, key) {
                return Lazy(x).size() && !W2PRESOURCE.linking.get(key);
            }).each(function (ids, indexName) {
                changed = true;
                if (indexName in INDEX_UNLINKED) {
                    var ref = INDEX_UNLINKED[indexName];
                    W2PRESOURCE.linking.source[indexName] = 1;
                    //log('linking.' + indexName + ' = ' + W2PRESOURCE.linking.source[indexName]);
                    var filter = Lazy(ids).keys().compact().difference(ASKED_UNLINKED[indexName]);
                    if (filter.size()) {
                        var f = {};
                        f[ref.id] = filter.toArray();
                        W2PRESOURCE.list(ref.by, {filter: f}, undefined, function (data) {
                            W2PRESOURCE.linking.source[indexName] = 0;
                            //log('linking.' + indexName + ' = ' + W2PRESOURCE.linking.source[indexName]);
                            ASKED_UNLINKED[indexName] = Lazy(filter.union(ASKED_UNLINKED[indexName]).toArray());
                        });
                    } else {
                        W2PRESOURCE.linking.source[indexName] = 0;
                        //log('linking.' + indexName + ' = ' + W2PRESOURCE.linking.source[indexName]);
                    }
                }
                for (var i in ids) {
                    delete UNLINKED_INDEX[indexName][i];
                }
            });
            Lazy(MISSING_PERMISSIONS).filter(function (x) {
                return (x.length > 0) && (!(x in permissionWaiting));
            }).each(function (x, resourceName) {
                changed = true;
                var ids = MISSING_PERMISSIONS[resourceName].splice(0);
                permissionWaiting[resourceName] = 1;
                W2P_POST(resourceName, 'my_perms', {ids: Lazy(ids).unique().toArray()}, function (data) {
                    W2PRESOURCE.gotPermissions(data.PERMISSIONS);
                    delete permissionWaiting[resourceName]
                });

            });
        };
        this.getCached = function (resourceName, ids, scope, callBack) {
            if (W2PRESOURCE.linking.get(resourceName)){
                //attendi e agganciati
                return $timeout(function(){
                    W2PRESOURCE.getCached(resourceName,ids,scope,callBack);
                },300);
            }
            var idx = getIndex(resourceName);
            var missing = Lazy(ids).filter(function (x) {
                return !idx.get(x)
            }).map(function (x) {
                return x && ('' + x)
            }).toArray();
            if (missing.length) {
                // TODO : fare in modo che gli id corrispondano alla richiesta
                W2PRESOURCE.linking.source[resourceName] = 1;
                W2PRESOURCE.list(resourceName, {filter: {id: missing}}, scope, function (data) {
                    if (callBack) {
                        callBack.apply(scope, [Lazy(ids).map(function (x) {
                            return idx.get(x)
                        }).toArray()])
                    }
                    W2PRESOURCE.linking.source[resourceName] = 0;
                });
            } else {
                if (callBack) {
                    callBack.apply(scope, [Lazy(ids).map(function (x) {
                        return idx.get(x)
                    }).toArray()])
                }
            }
        };
        $interval(this.linkUnlinked, 400, null, false);
        $interval(function(){
            $http.get(base_url + $rootScope.options.application + '/api/live_again');
                //.success(function(){
                //    $.notify('Ciao');
                //});
        },600000);
        //$interval(this.linkUnlinked,1500,null,true);
        this.getUser = function (callBack) {
            W2PRESOURCE.describe('auth_user', function (model) {
                if (('auth_user' in IDB) && IDB.auth_user.contains($rootScope.options.user.id)) {
                    callBack(IDB.auth_user.get($rootScope.options.user.id));
                } else {
                    W2PRESOURCE.list('auth_user', {filter: {id: $rootScope.options.user.id}}, null, function () {
                        if (callBack) {
                            callBack(IDB.auth_user.get($rootScope.options.user.id));
                        }
                    });
                }
            });
        };
        this.resolveObject = function (model, reference, cb, scopes) {
            if (!reference) return;
            if (!model) {
                $log.error('unable to find reference without a model');
                return;
            }
            if (model.constructor.name == 'String') {
                if (model in W2PRESOURCE.modelCache) {
                    model = W2PRESOURCE.modelCache[model];
                } else {
                    return W2PRESOURCE.describe(model, function (model) {
                        W2PRESOURCE.resolveObject(model, reference, cb, scopes);
                    });
                }
            }
            if (scopes && (scopes.constructor.name == 'Scope')) {
                scopes = [scopes];
            }
            if (scopes) {
                if ((typeof(reference) == 'string') && !isFinite(reference)) {
                    $log.warn('sting reference', reference);
                    for (var i = 0; i < scopes.length; i++) {
                        try {
                            var ret = $parse(reference)(scopes[i]);
                            if (ret.constructor == model) {
                                return cb(ret);
                            }
                            if (ret) {
                                return W2PRESOURCE.resolveObject(model, ret, cb, scopes);
                            }
                        } catch (e) {
                            $log.info(e.name, e.message);
                        }
                    }
                } else if ((reference.constructor.name == 'Number') || isFinite(reference)) {
                    $log.warn('Number reference', reference);
                    for (var i = 0; i < scopes.length; i++) {
                        try {
                            var ret = IDB[model._modelName].get(reference);
                            if (ret && (ret.constructor == model)) {
                                return cb(ret);
                            } else {
                                if (reference) {
                                    W2PRESOURCE.getCached(model._modelName, [reference], scopes[i], function (objs) {
                                        cb(objs && objs[0]);
                                    });
                                } else {
                                    $log.warn('unavailable object ', model._modelName, reference);
                                }
                            }
                        } catch (e) {
                            $log.info(e.name, e.message);
                        }
                    }
                }
            }
        }
    });
    app.service('tt', function () {
        this.tt = function (x) {
            return x;
        }
    });
    app.directive('w2pData', function (w2p, w2pResources, $rootScope, $parse, $compile, $timeout) {
        /*
         Fetch data from server and manage item selections
         Direcive <w2p-data> args:

         name            : links this scope to parent named by <name> attribute

         #    #   #  # ### Data fetching ### #  #   #    #

         resource        : string : resource name you want to access
         with            : string : comma separated list of other resources you want to fetch as completent of <resource>
         i.e. :
         resource="folder" with="document,tags" filter={parent : [10,11]}
         will fetch folders where parent is in [10,11] and all document related to these folders and
         all tags related to these folder in a single request

         filter          : string : object like {<fileld> : [<allowed items>]}
         for             : not yet implemented

         #    #   #  # ### Data selection ### #  #   #    #

         select-on       : string : function name used from parent scope to select data (default is "select<capitalized resource name>")
         select-name     : string : when an item is selected, an attribute on the parent scope will contains this data.
         the name of this attribute is <select-name> (default is "selected<capitalized resource name>")
         multiselect     : boolean : if you want a multiple selection you can use set this to true (default false).
         if multiselection is enabled parent scope variable <select-name> will be an array.
         */
        return {
            controller: function ($scope) {
            },
            restrict: 'E',
            scope: true,
            link: function (scope, element, attrs) {
                scope.controller = findControllerScope(scope);
                scope.resourceName = attrs.resource;
                scope.selection = attrs.selection;
                //scope.fields = attrs.fields?attrs.fields.split(','):false;
                scope.items = false;
                scope.onArrived = function (evt) {
                    scope.items = w2pResources.IDB[scope.resourceName].filter(scope.filterItems).values().toArray();
                    if ('persistentSelection' in attrs) {
                        var idxItems = Lazy(scope.items).indexBy('id');
                        if (multiSelection) {
                            Lazy(angular.fromJson(localStorage[selectionKey])).each(function (sel) {
                                idxItems.get(sel)._selected = false;
                            });
                        } else {
                            scope.controller[selectFuncName](idxItems.get(parseInt(localStorage[selectionKey])));
                        }
                    }
                    if (attrs.onLoad) {
                        $parse(attrs.onLoad)(scope);
                    }
                    // this signal is listened once.
                    scope.arrivedUnbind();
                };
                // attaching to events
                scope.$on('new-' + scope.resourceName, function (evt, idx) {
                    if (scope.items == false) {
                        scope.items = [];
                    }
                    idx.filter(scope.filterItems).each(function (x) {
                        scope.items.push(x);
                    });
                    try {
                        scope.$parent.$digest();
                    } catch (e) {
                    }
                    if (attrs.onUpdate) {
                        $parse(attrs.onUpdate)(scope);
                    }
                });
                scope.$on('deleted-' + scope.resourceName, function (evt, ids) {
                    var i = Lazy(ids);
                    scope.items = Lazy(scope.items).filter(function (x) {
                        return !(i.contains(x.id + '') || i.contains(x.id))
                    }).toArray();
                });
                scope.$on('updated-' + scope.resourceName, function (evt, items) {
                    var is = Lazy(scope.items).pluck('id');
                    Lazy(items).each(function (item) {
                        //log(item[0].name,scope.filter);
                        var filtered = item.map(scope.filterItems);
                        //log(filtered);
                        if (filtered[0] ^ filtered[1]) {
                            if (filtered[0]) {
                                scope.items.push(item[0]);
                            } else {
                                var idx = Lazy(scope.items).pluck('id').indexOf(item[0].id);
                                if (idx >= 0)
                                    scope.items.splice(idx, 1);
                            }
                        }
                        //if (filtered[0]){
                        //    var i = is.indexOf(item[0].id);
                        //    if (i > -1){
                        //        scope.items[i] = item[0];
                        //    }
                        //}
                    });
                    if (attrs.onUpdate) {
                        $parse(attrs.onUpdate)(scope);
                    }
                });
                // attaching to reference events
                var localFilter = null;
                if (attrs.localFilter){
                    localFilter = $parse(attrs.localFilter)(scope.$parent);
                }
                scope.load = function () {
                    var options = {};
                    //if (attrs.fields){
                    //    options.fields = attrs.fields.split(',');
                    //}
                    w2pResources.describe(scope.resourceName, function (model) {
                        if (attrs.filter) {
                            options.filter = $parse(attrs.filter)(scope);
                            if (options.filter) {
                                options.filter = Lazy(options.filter).map(function (v, k) {
                                    return [k, Array.isArray(v) ? Lazy(v).map(function (x) {
                                        if (x === null){ return null;}
                                        return x.toString()
                                    }).toArray() : (v ? [v.toString()] : [null])];
                                }).toObject();
                            }
                            var underscore = model._underscore;
                            var filter = Lazy(options.filter).map(function (v, k) {
                                var lv = Lazy(v).map(function (x) {
                                    return [x, 1]
                                }).toObject();
                                return (k in underscore) ? ['_' + k, lv] : [k, lv];
                            }).toObject();
                            if (localFilter) {
                                scope.filterItems = makeFilter(model, filter);
                                //TODO missing localFilter
                            } else {
                                scope.filterItems = makeFilter(model, filter);
                            }
                        } else {
                            if (localFilter) {
                                scope.filterItems = localFilter;
                            } else {
                                scope.filterItems = function (x) {
                                    return true;
                                };
                            }
                            if ('with' in attrs) {
                                options.together = attrs.with;
                            }
                        }
                        scope.opts = options;
                        w2pResources.linking.source[scope.resourceName] = 1;
                        if ('together' in options) {
                            Lazy(options.together).split(',').each(function (x) {
                                w2pResources.linking.source[x] = 1;
                            });
                            w2pResources.linking.source.m2m = 1;
                        }
                        w2pResources.list(scope.resourceName, scope.opts, scope, function (data) {
                            w2pResources.linking.source[scope.resourceName] = 0;
                            if ('together' in scope.opts) {
                                Lazy(scope.opts.together).split(',').each(function (x) {
                                    w2pResources.linking.source[x] = 0;
                                });
                            }
                            w2pResources.linking.source.m2m = 0;
                        });
                    });
                };
                // default options
                var selectFuncName = 'select' + capitalize(scope.resourceName);
                var multiSelection = false;
                var selectionVarName = 'selected' + capitalize(scope.resourceName);
                var selectAllName = 'selectAll';
                var selectionKey = scope.resourceName + ':' + selectionVarName;
                // adding standard methods to parent scope / controller
                if (attrs.selectOn) {
                    selectFuncName = attrs.selectOn;
                }
                if (attrs.selectName) {
                    selectionVarName = attrs.selectName;
                }
                if ('multiselect' in attrs) {
                    multiSelection = true;
                }
                if (attrs.selectAll) {
                    selectAllName = attrs.selectAll;
                }
                scope.controller[selectAllName] = function () {
                    var selectionResult = true;
                    if (scope.controller[selectionVarName].length) {
                        selectionResult = false;
                    }
                    Lazy(scope.items).each(function (x) {
                        x._selected = selectionResult
                    });
                };
                scope.controller[selectFuncName] = function (item) {
                    if (!item) {
                        return;
                    }
                    $rootScope.$broadcast('select-' + scope.resourceName, item);
                    if (scope.controller) {
                        var oldSelected = scope.controller[selectionVarName];
                        if (item != oldSelected) {
                            if (multiSelection) {
                                item._selected = !item._selected;
                                scope.controller[selectionVarName] = Lazy(scope.items).filter(function (x) {
                                    return x._selected
                                }).toArray();
                            }
                            else {
                                if (oldSelected) {
                                    oldSelected._selected = false;
                                }
                                scope.controller[selectionVarName] = item;
                            }
                            if ('persistentSelection' in attrs) {
                                if (multiSelection) {
                                    localStorage[selectionKey] = Lazy(scope.controller[selectionVarName]).pluck('id');
                                } else {
                                    localStorage[selectionKey] = item.id;
                                }
                            }
                        }
                    }
                };
                if (scope.controller) {
                    if (!('ITEMS' in scope.controller)) {
                        var wrapper = function () {
                        };
                        var citems = new wrapper();
                        scope.controller.ITEMS = citems;
                    } else {
                        var citems = scope.controller.ITEMS;
                    }
                    try {
//                        log('aggiungo la prop ' + scope.resourceName + ' a ' + scope.controller.$id);
                        Object.defineProperty(citems, scope.resourceName, {
                            get: function () {
                                return scope.items;
                            }
                        })
                    } catch (e) {
                    }
                }
                if ('filter' in attrs) {
                    attrs.$observe('filter', function (val) {
                        scope.arrivedUnbind = scope.$on('arrived-' + scope.resourceName, scope.onArrived);
                        scope.load();
                    });
                } else {
                    scope.arrivedUnbind = scope.$on('arrived-' + scope.resourceName, scope.onArrived);
                    scope.load();
                }
                if ('name' in attrs) {
                    scope.controller[attrs.name] = scope;
                }
            }
        }
    });
    app.directive('modelForm', function (w2pResources, $rootScope, $parse, $log) {
        'use strict';
        /*
         Directive modelForm args:
         resource                    : resource name to ask
         edit (valued on parent)     : enables edit mode
         new (valued on parent)      : force a new object to represent
         fields                      : ',' separated list of fields to be considered by the form
         hidden-fields               : ',' separated list of fields to be hidden to user but sent by the form
         extra                       : array of object using describe field protocol like "[{id : 'name',writable : true ,....}]"
         values (valued on parent)   : object {name -> value} to set default value to fields
         record (valued on parent)   : object to be updated or id of that object
         on-submit (valued on parent): function to be called after form sent and accepted
         before-send(valued on paren): callBack function called before sending object to server (usefull to correct incorrect data)
         verb                        : verb name to send object to (default : put)
         template-url                : url to another template to represent this
         send-on                     : function name that parent calls to send form data (default is send<capitalized model name>)
         out-model                   : name of model to put on parent controller
         filters                     : field based filter object, useful for filter reference and force a reference set
                                       i.e.: {doc : {parent : [1,2,3]}} will limit a document where parent in (1,2,3)
         localFilters                : use localFilters for referenced fields
         */
        return {
            scope: true,
            requires: ['resource'],
            //template : function(elem,attrs){},
            templateUrl: function (elem, attrs) {
                if (attrs.templateUrl) {
                    try {
                        var rootScopedUrl = $parse(attrs.templateUrl)($rootScope);
                        if (Lazy(rootScopedUrl).startsWith('/')){
                            return rootScopedUrl;
                        } else {
                            return $rootScope.options.baseTemplates + attrs.templateUrl;
                        }
                    } catch(e){
                        return $rootScope.options.baseTemplates + attrs.templateUrl;
                    }
                }
                return '/lib/rwt/templates/model-form.html';
            },
            link: function (scope, elem, attrs) {
                if (attrs.parentScope) {
                    if (isFinite(attrs.parentScope)) {
                        var x = parseInt(attrs.parentScope);
                        var parentScope = scope;
                        while (x) {
                            x--;
                            parentScope = parentScope.$parent;
                        }
                        scope.parentScope = parentScope;
                    } else {
                        scope.parentScope = $parse(attrs.parentScope)(scope);
                    }
                }
                if (!scope.parentScope)
                    scope.parentScope = findControllerScope(scope);
                if (scope.parentScope.$id == scope.$id) {
                    scope.parentScope = scope.$parent;
                }
                if (!w2pResources.formIdx) {
                    w2pResources.formIdx = 1;
                }
                scope.formIdx = w2pResources.formIdx++;
                scope.obj = false;
                scope.isHtml5 = navigator.userAgent.match(/webkit/i) ? true : false;
                scope.showFields = [];
                scope.resourceName = attrs.resource;
                scope.hiddenFields = attrs.hiddenFields ? Lazy(Lazy(attrs.hiddenFields).split(',').concat('id').toArray()) : Lazy(['id']);
                var newObject = attrs.new ? $parse(attrs.new)(scope.$parent) : (attrs.record ? false : true);
                scope.edit = attrs.edit ? $parse(attrs.edit)(scope.$parent) : newObject;
                scope.form = true;
                if (attrs.filters){
                    scope.filters = angular.fromJson(attrs.filters);
                }
                //var OBJ = {};
                var values = {};
                var oldObj = null;
                var fieldNames = [];
                var sendingNames = [];
                var fields = [];
                var fieldIdx = Lazy(fields).indexBy('id');
                var record = {};
                var fixed = attrs.fixed ? Lazy(attrs.fixed).split(',') : Lazy();
                var rtObject = null;
                var createObject = function(values){
                    // create new object by model
                    var ret = new scope.model(values);
                    // set default values
                    Lazy(scope.model._fields)
                    .filter(function(x){
                        return x.options && ('default' in x.options)
                    })
                    .each(function(x){
                        ret[x.id] = x.options.default;
                    });
                    return ret;
                };
                var UVA = function () {
                    Lazy(values).each(function (v, k) {
                        if (k in scope.model._underscore) {
                            if (isFinite(v)) {
                                scope.obj['_' + k] = v;
                            } else {
                                scope.obj[k] = v;
                                scope.obj['_' + k] = v.id;
                            }
                        } else {
                            scope.obj[k] = v;
                        }
                    });
                }
                var refreshObject = function () {
                    //check presence of ALL (rtObject,scope.model)
                    if (!scope.model) return;
                    if (!(rtObject || newObject)) return;
                    if (scope.edit) {
                        if (newObject) {
                            scope.obj = createObject();
                        } else {
                            scope.obj = rtObject.copy();
                            Lazy(scope.hiddenFields).each(function (x) {
                                if (!(x in scope.obj)) {
                                    scope.obj[x] = rtObject[x];
                                }
                            })
                        }
                        UVA();
                        if (attrs.outModel) {
                            scope.parentScope[attrs.outModel] = scope.obj;
                        }
                    } else {
                        scope.obj = rtObject;
                        if ('forceId' in attrs) {
                            UVA();
                        }
                    }
                    if (scope.edit){
                        scope.$broadcast('form-edit', scope, scope.obj, scope.edit);
                        scope.$emit('form-edit', scope, scope.obj, scope.edit);
                    }
                };
                var updateValues = function (val) {
                    values = val;
                    if (rtObject) {
                        refreshObject();
                    } else {
                        $log.error('updateValues without object');
                        if (scope.model){
                            scope.obj = new scope.model(val);
                        }
                    }
                };
                var updateObj = function (val) {
                    if (!scope.model) {
                        if (attrs.resource in w2pResources.modelCache) {
                            gotModel(w2pResources.modelCache[attrs.resource]);
                        } else {
                            return w2pResources.describe(attrs.resource, function () {
                                gotModel(w2pResources.modelCache[attrs.resource]);
                            })
                        }
                    }
                    newObject = (val == null) || (val == undefined);
                    /*
                     if ('forceId' in attrs){
                     var modelName = scope.model._modelName;
                     if (isFinite(val) && (modelName in w2pResources.IDB) && !(w2pResources.IDB[modelName].get(parseInt(val)))){
                     newObject = true;
                     }
                     }
                     */
                    if (newObject) {
                        rtObject = createObject(values);
                        /*
                         if ('forceId' in attrs){
                         rtObject = new scope.model(values);
                         } else {
                         rtObject = new scope.model();
                         }
                         */
                    }
                    else {
                        if (val.constructor != scope.model) {
                            return w2pResources.resolveObject(scope.model, val, updateObj, [scope.parentScope, scope])
                        }
                        rtObject = val;
                    }
                    if (Lazy(values).size()) updateValues(values);
                    else refreshObject();
                };
                var getAllFields = function (model) {
                    var result = Lazy(model._fields);
                    var f2 = Lazy(['id', 'name', 'type', 'comment', 'writable', 'validators', 'to', 'options']);
                    if (attrs.extra) {
                        result = result.concat($parse(attrs.extra)(scope.$parent));
                    }
                    result = result.map(function (x) {
                        return f2.map(function (k) {
                            return [k, x[k]]
                        }).toObject()
                    }).toArray();
                    Lazy(result).each(function (field) {
                        field.atype = AJS2W2P_TYPES[field.type];
                        /*
                         if (!field.template) {
                         field.template = AJS2W2P_TYPES_TEMPLATE[field.type];
                         if (field.validators && (field.validators.valid)) {
                         field.template = 'selection';
                         }
                         }
                         */
                        field.writable = !fixed.contains(field.id) && field.writable;
                    });
                    return result;
                };
                var gotModel = function (model) {
                    fields = getAllFields(model);
                    fieldIdx = Lazy(fields).indexBy('id');
                    fieldNames = attrs.fields ? Lazy(attrs.fields).split(',') : Lazy(model._fieldsOrder);
                    if (attrs.extra) {
                        var n = fieldNames.map(function(x){return [x,1]}).toObject
                        fieldNames = fieldNames.concat(Lazy($parse(attrs.extra)(scope.$parent)).pluck('id')).unique();                       
                    }
                    if (attrs.hiddenFields) {
                        fieldNames = fieldNames.concat(Lazy(attrs.hiddenFields).split(','));
                    }
                    fieldNames = fieldNames.toArray();
                    var unknownFields = Lazy(fieldNames).difference(Lazy(fieldIdx).pluck('id')).toArray();
                    if (unknownFields.length) {
                        log('unknown fields ' + Lazy(unknownFields).join(','));
                    }
                    scope.referenceSelect = function (item, field) {
                        scope.obj['_' + field.id] = item.id;
                    };
                    scope.model = model;
                    scope.showFields = Lazy(fieldNames).filter(function (name) {
                        return !scope.hiddenFields.contains(name)
                    }).map(function (x) {
                        return fieldIdx.get(x)
                    }).toArray();
                    scope.showDates = Lazy(scope.showFields).map(function (x) {
                        return [x.id, false];
                    }).toObject();
                    if (newObject) {
                        scope.showFields = Lazy(scope.showFields).filter(function (field) {
                            return field.writable
                        }).toArray();
                    }
                    sendingNames = Lazy(scope.showFields).pluck('id').concat(scope.hiddenFields).toArray();
                    w2pResources.resolveObject(scope.model, attrs.record, updateObj, [scope.parentScope, scope]);
                    if (!scope.obj){
                        updateObj();
                    }
                    // local filters
                    if (attrs.localFilters){
                        var localFilterObject = angular.fromJson(attrs.localFilters);
                        var filterReferences = {};
//                        Lazy(localFilterObject).map(function(v,k){return [k,null];}).toObject();
                        var gotFilterReference = function(submodel){
                            filterReferences[submodel._modelName] = submodel;
                            if (!Lazy(filterReferences).values().filter(function(x){return !x}).size()){
                                scope.localFilters = Lazy(localFilterObject).map(function(v,k){
                                    return [k,makeFilter(filterReferences[model._fields[k].to],v)];
                                }).toObject();
                            } 
                        }
                        Lazy(localFilterObject).each(function(v,k){
                            filterReferences[model._fields[k].to] = null;
                            w2pResources.describe(model._fields[k].to,gotFilterReference)
                        });
                    }
                    scope.$broadcast('form-edit', scope, scope.obj, scope.edit);
                };
                var afterSend = function (data) {
                    if (!data.errors) {
                        scope.edit = false;
                        if (attrs.edit) {
                            try {
                                $parse(attrs.edit).assign(scope.parentScope,false);
                            } catch (e) {
                                if ((attrs.edit == 'true') || (attrs.edit == 'false')) {
                                }
                                else {
                                    try {
                                        scope.controller[attrs.edit] = false;
                                    } catch (e) {
                                    }
                                }
                            }
                            scope.errors = {};
                        }
                        if (attrs.onSubmit) {
                            var parsed = $parse(attrs.onSubmit);
                            var res = parsed(scope.parentScope);
                            if (res && (res.constructor.name == 'Function')) {
                                res.apply(scope.$parent[attrs.onSubmit], scope.lastSent);
                            }
//                            .apply(scope.$parent[attrs.onSubmit],scope.lastSent);
                        }
                        refreshObject(scope.obj)
                    }
                };
                var _mod = w2pResources.modelCache[attrs.resource];
                var changeFilter = function(val){
                    scope.filters = $parse(val)(scope);
                };
                if (_mod) {
                    gotModel(_mod)
                } else {
                    w2pResources.describe(attrs.resource, gotModel);
                }
                if (attrs.record) {
                    scope.$parent.$watch(attrs.record, updateObj);
                    updateObj(attrs.record);
                } else {
                    updateObj(null);
                }
                if (attrs.values) {
                    scope.$parent.$watch(attrs.values, updateValues);
                }
                if (attrs.edit) {
                    scope.$watch(attrs.edit, function (val) {
                        scope.edit = val;
                        if (scope.edit && rtObject) {
                            scope.obj = rtObject.copy();
                            Lazy(scope.hiddenFields).each(function (f) {
                                if (!(f in scope.obj)) {
                                    scope.obj[f] = rtObject[f];
                                }
                            });
                            /*
                             Lazy(scope.model._underscore).keys().each(function(x){
                             if (scope.obj[x])
                             scope.obj['__'] = scope.obj[x].toString();
                             });
                             */
                        } else {
                            scope.obj = rtObject;
                        }
                        scope.$broadcast('form-edit', scope, scope.obj, val);
                        refreshObject(scope.obj);
                    });
                }
                if (attrs.hiddenFields) {
                    Lazy(attrs.hiddenFields).split(',').map(function (x) {
                        return fieldIdx.get(x)
                    }).each(function (field) {
                        if (field) {
                            field.hidden = true;
                        }
                    });
                }
                if (attrs.new) {
                    scope.$parent.$watch(attrs.new, function (val) {
                        newObject = val;
                        gotModel(scope.model);
                    });
                }
                if (attrs.filters){
                    attrs.$observe('filters',changeFilter);
                }
                if (attrs.footer){
                    scope.footer = attrs.footer;
                }
                scope.send = function () {
                    if (!scope.obj) {
                        return $log.error('Nothing to send');
                    }
                    var underscore = Lazy(fields).filter(function (x) {
                        return Lazy(x.type).contains('reference')
                    }).pluck('id').map(function (x) {
                        return [x, 1]
                    }).toObject();
                    var sendingNames = Lazy(scope.showFields).pluck('id').concat(scope.hiddenFields).toArray();
                    var sendObj = Lazy(sendingNames).map(function (name) {
                        return [name, scope.obj[(name in underscore) ? '_' + name : name]];
                    }).toObject();
                    Lazy(fields).filter(function (x) {
                        return (x.type == 'date') || (x.type == 'datetime')
                    }).each(function (x) {
                        if (sendObj[x.id]) {
                            var unixTime = sendObj[x.id].getTime();
                            sendObj[x.id] = Math.round(unixTime / 1000);
                        }
                    });
                    Lazy(fields).filter(function (x) {
                        return !x.writable
                    }).each(function (field) {
                        if (field.id in sendObj) {
                            delete sendObj[field.id];
                        }
                    });
//                    sendObj = Lazy(sendObj).filter(function(v,k){return v && v.toString().length}).toObject();
                    for (var k in sendObj) {
                        if (sendObj[k] == null) {
                            sendObj[k] = '';
                        }
                    }
                    if (!sendObj.id && ('id' in sendObj)) {
                        delete sendObj.id;
                    }
                    sendObj.formIdx = scope.formIdx;
                    if (attrs.beforeSend) {
                        scope.$parent[attrs.beforeSend].apply(scope.$parent, [sendObj]);
                    }
                    scope.lastSent = sendObj;
                    var verb = sendObj.id ? 'post' : 'put';
                    if ('forceId' in attrs) {
                        if (sendObj.id) {
                            verb = (sendObj.id in w2pResources.IDB[attrs.resource].source) ? 'post' : 'put';
                        } else {
                            sendObj.id = $parse(attrs.record)(scope);
                        }
                    }
                    if ('verb' in attrs) {
                        w2pResources.custom(attrs.resource, attrs.verb, sendObj, afterSend, scope.$parent);
                    } else {
                        w2pResources[verb](attrs.resource, sendObj, afterSend, scope.$parent);
                    }
                };
                scope.$on('form-error-' + attrs.resource, function (evt, errors, formIdx) {
                    if (formIdx) {
                        if (formIdx != scope.formIdx) {
                            return;
                        }
                    }
                    scope.errors = errors;
                });
                /*
                 scope.$on('arrived-' + attrs.resource,function(evt){
                 if (!newObject){
                 oldObj = w2pResources.IDB[attrs.resource].get(scope.obj.id);
                 if (!scope.edit){
                 scope.obj = oldObj;
                 }
                 }
                 });
                 */
                var sendFuncName = 'send' + capitalize(attrs.resource);
                if (attrs.sendOn) {
                    sendFuncName = attrs.sendOn;
                }
                scope.parentScope[sendFuncName] = scope.send;
            }
        }
    });
    app.directive('feModel', function ($compile, $http, $templateCache) {
        return {
            scope: true,
            restrict: 'A',
            template: function (elem, attrs) {
                var objName = attrs.obj||'obj';
                //var scope = elem.scope();
                //var form = findControllerAs(scope, function(x){
                //    return x.form;
                //}) || scope;
                return '{* ' + objName + '.' + attrs.feModel + '*}';
            },
            link: function (scope, elem, attrs) {
                var gotTemplate = false;
                var template = false;
                var objName = attrs.obj||'obj';
                var changeObj = function (value) {
                    scope[objName] = value
                };
                var onEdit = function (evt, formScope, obj, editing) {
                    scope.edit = editing;
                    //scope.obj = obj;
                    var mod = attrs.feModel;
                    scope.field = Lazy(formScope.showFields).find(function (x) {
                        return x.id == mod
                    });
                    template = scope.field.type;
                    var replace = function (data) {
                        var errors = '<div class="alert alert-danger alert-dismissible" role="alert" ng-if="errors[field.id]">' +
                            '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
                            '<strong><h4>{* errors[field.id] *}</h4></strong>' +
                            '</div>';
                        elem.html(data.data2 + errors);
                        $compile(elem.contents())(scope);
                        formScope.$watch('obj', changeObj);
                    };
                    if (!gotTemplate && template) {
                        gotTemplate = true;
//                        $http.get('/' + scope.options.application + '/static/plugin_angular/templates/fields/' + template + '.html', {cache: $templateCache})
                        $http.get('/lib/rwt/templates/fields/' + template + '.html', {cache: $templateCache})
                            .then(replace);
                    }
                };
                scope.$on('form-edit', onEdit);
            }
        }
    });
})();

