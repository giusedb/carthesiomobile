/**
 * Author: Giuseppe Di Bona <giuseppe@demalogic.it>
 */
"use strict";

//var base_url = 'http://www.carthesio.it/';
var base_url = 'http://2.236.16.80:8888/';

function Login($http, $rootScope) {
    var options = {headers: {'Content-Type' : 'text/plain'}};

    if ('loginObj' in localStorage) {
        this.loginObj = JSON.parse(localStorage.loginObj);
    } else {
        this.loginObj = {username: null, password: null, tenant: null};
    }

    this.localSave = function() {
        localStorage['loginObj'] = JSON.stringify(this.loginObj);
    }

    this.login = function(callBack, errorBack, force) {
        var self = this;
        
        if (!this.loginObj.username || !this.loginObj.password || !this.loginObj.tenant) {
            errorBack({data: {error: 'Devi inserire tutti dettagli di accesso (username, password, tenant)'} });
        } else {
            $rootScope.waiting = true;
            var success = function(x) {
                if ((x.data) && ('error' in x.data)){
                    return reject(x);
                }
                console.log('logged in');
                x.data.wheelTemplates = '/lib/rwt/templates/';
                x.data.thumbUrl = base_url + x.data.application + '/filemanager/thumbnails/';
                x.data.imgUrl = base_url + x.data.application + '/filemanager/previews/';
                $rootScope.waiting = false;
                self.loginObj.sessionId = x.data.session_id;
                self.localSave();
                callBack(x);
                $rootScope.$broadcast('loggedIn');
            };
            
            var reject =  function(x) {
                $rootScope.waiting = false;
                console.log('log in failed')
                if (x.status !== 200) {
                    errorBack({data: {error: 'Tenant not found'}});
                } else {
                    errorBack(x);
                }
            };

            if (!force && self.loginObj.sessionId) {
                $http.post(base_url + this.loginObj.tenant + '/api/status', {sessionId: self.loginObj.sessionId}, options)
                    .then(success, reject);
            } else { 
                $http.post(base_url + this.loginObj.tenant + '/api/login', {username: this.loginObj.username, password: this.loginObj.password}, options)
                    .then(success, reject);
            } 
        }
    }
     
    this.logout = function() {
        this.loginObj.username = null;
        this.loginObj.password = null;
        delete this.loginObj.sessionId;
        console.log('Logging out...', this.loginObj);
        $http.post(base_url + this.loginObj.tenant + '/api/logout', {}, options)
        this.localSave();
    }
    this.hasInfo = function () {
        return Boolean(this.loginObj.username && this.loginObj.password && this.loginObj.tenant);
    }
}

(function (ons) {
    var login = null;
    var app = ons.bootstrap('carthesioMobile', ['web2angular', 'ui.router', 'ngSanitize']);
    app.controller('AppController', function($scope, $rootScope, $http, $timeout, w2pResources){
        login = new Login($http, $rootScope);
        $rootScope.serverStatus = 'waiting';
        $rootScope.realtimeConnected = false;
        $rootScope.showDoc = function(doc) {
            if (doc.constructor.name === 'doc') {
                doc = doc.id;
            }
            $rootScope.$broadcast('showDoc', doc);
        }

        w2pResources.addBuilderHandler('doc',function(Model) {
            Object.defineProperty(Model.prototype, 'thumbUrl', {get : function() {
                if (this.has_thumbnail) {
                    return $rootScope.options.thumbUrl + this.id + '.jpg?_session_id=' + $rootScope.options.session_id;
                } else {
                    return base_url + $rootScope.options.application + '/static/img/unavailable.thumb.jpg';
                }
            }});

            Object.defineProperty(Model.prototype, 'imgUrl', {get : function() {
                if (this.has_preview) {
                    return $rootScope.options.imgUrl + this.id + '.jpg?_session_id=' + $rootScope.options.session_id;
                } else {
                    return base_url + $rootScope.options.application + '/static/img/unavailable.thumb.jpg';
                }
            }});            

            Model.prototype.download = function () {
                this.downloader(function (x) {
                    document.getElementById('downFrame').setAttribute('src', base_url + x.slice(1) + '?_session_id=' + $rootScope.options.session_id);
                })
            }
        });

        w2pResources.addBuilderHandler('verbale',function(Model) {
            Model.toString = function() {
                return this.seconda_data + ' presso ' + this.secondo_luogo;
            };
        });

        var userDetailsShown = false;
        if (login.hasInfo()) { 
            login.login(function(x){
                $rootScope.serverStatus = x.data.server_status || 'ready';
                $rootScope.options = x.data
                $rootScope.showLogin = false;
            }, function(x) {
                $rootScope.showLogin = true;
            });
        } else {
            $rootScope.showLogin = true;
        }
        $scope.$on('loggedIn', function() {
            console.log('loggedIn event');
            $scope.loggedIn = true;
            $rootScope.serverStatus = $rootScope.options.server_status;
            $timeout(function(){
                mainTabbar.on('postchange', function(evt){
                    $rootScope.activePage = evt.detail.index; 
                });                
            },1);
        });

    });

    app.controller('loginController', function($scope, $rootScope, $timeout) {
        $scope.loginObj = login.loginObj;
        $scope.errors = false;
        this.login = function() {
            login.login(function(x){
                $rootScope.options = x.data;
                $rootScope.showLogin = false;
                $scope.loggedIn = true;
            }, function(x) {
                $scope.loggedIn = false;
                $rootScope.showLogin = true;
                $scope.errors = x.data.error;
            });
        }
        $scope.logout = function() {
            login.logout();
            userDetails.hide().then(function() {
                $rootScope.showLogin = true;
                $rootScope.loggedIn = false;
                $timeout();
            });
        }
    });

    app.controller('condominio', function($scope, $rootScope, w2pResources) {
        $scope.condomini = [];
        var afterLogin = function() {
            console.log('afterLogin');
            w2pResources.list('condominio', {}, null, function(c) { 
                $scope.condomini = c;
                if (c.length === 1) {
                    $rootScope.ilCondominio = c[0];
                    $rootScope.$broadcast('condominioSelect');
                } else {
                    console.warn('trovati ' + c.length + ' condomini');
                }
            });
        }
        
        if ($rootScope.serverStatus === 'ready') {
            afterLogin();
        } else {
            $scope.$on('loggedIn', afterLogin);
        }

        $scope.navigateDetails = function(obj) {
            var url = 'templates/dettagli_' + obj.constructor._modelName + '.html';
            $scope.item = obj;
            condominioNavigator.pushPage(url);
        };
    });

    app.controller('documentale', function($scope, $rootScope, $timeout, w2pResources) {
        $scope.pageIsActive = false;
        var folderStack = [];
        
        var getMainFolder = function() {
            w2pResources.getCached('folder',[$rootScope.ilCondominio._main_folder], $scope, function(folders) {
                $scope.currentFolder = folders[0];
                folderStack.push($scope.currentFolder.id);
            });
        };

        var goToFolder = function(folder) {
/*
            if ($scope.currentFolder._parent === folder.id) {
                documentNavigator.insertPage(0,'templates/folder_list.html').then(function() {
                    documentNavigator.popPage();                
                })
            } else {
                documentNavigator.pushPage('templates/folder_list.html');
            }
            folderStack.unshift($scope.currentFolder.id);
*/            
            $scope.currentFolder = folder;
        };

        if ($rootScope.ilCondominio) {
            getMainFolder();
        } else {
            $scope.$on('condominioSelect', getMainFolder);
        }
        
        mainTabbar.on('postchange', function(evt) {

            $rootScope.activeNavigator = 
            $scope.pageIsActive = (evt.detail.index === 1);
            $scope.$apply();
        });

        $timeout(function(){
            documentNavigator.on('postpush', function(evt) {
                documentNavigator.removePage(0);
                $timeout(function(){
                    console.log(documentNavigator.pages);
                });
            });
        })

        $scope.goToFolder = function(folder) {
            if (folder.constructor.name === 'folder') {
                goToFolder(folder);
            } else {
                w2pResources.getCached('folder', folder.id, function(folder) {
                    goToFolder(folder);
                });
            }
        };
    });

    app.controller('docDetail', function($scope, $parse, $attrs, w2pResources) {
        $scope.base_url = base_url;
        $scope.$on('showDoc', function(evt, id) {
            $scope.fullPreview = false;
            w2pResources.getCached('doc',[id], null, function(docs){
                if (docs.length) {
                    $scope.doc = docs[0];
                } else {
                    $scope.doc = null;
                }
                documentViewer.show(evt);
            });
        });

        $scope.toggleFull = function() {
            // mostra integralmente il pdf del documento
            $scope.fullPreview = !$scope.fullPreview;
        }
    });

    app.directive('avatar', function () {
        return {
            scope: false,
            template: function (element, attrs) {
                var user = attrs.user;
                return '<img title="{* ' + user + '.toString() *}" class="hvr-glow img-thumbnail img-circle img-responsive" ng-src="/{* options.application *}/static/img/avatars/{* ' + user + '.avatar *}.png" alt="{* ' + user + '.toString() *}"/>';
            },
            link: function (scope, element, attrs) {
            }
        }
    });

    ons.ready(function() {
        console.log('ONS ready')
    });    

})(ons);

