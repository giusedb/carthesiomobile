/**
 * Author: Giuseppe Di Bona <giuseppe@demalogic.it>
 */
"use strict";

//var base_url = 'http://www.carthesio.it/';
var base_url = 'http://localhost:8888/';

function Login($http, $rootScope) {
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
        var options = {headers: {'Content-Type' : 'text/plain'}};
        if (!this.loginObj.username || !this.loginObj.password || !this.loginObj.tenant) {
            errorBack({data: {error: 'Devi inserire tutti dettagli di accesso (username, password, tenant)'} });
        } else {
            $rootScope.waiting = true;
            var success = function(x) {
                if ((x.data) && ('error' in x.data)){
                    return reject(x);
                }
                x.data.wheelTemplates = '/lib/rwt/templates/';
                $rootScope.waiting = false;
                self.loginObj.sessionId = x.data.session_id;
                self.localSave();
                callBack(x);
            };
            var reject =  function(x) {
                $rootScope.waiting = false;
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
    this.hasInfo = function () {
        return Boolean(this.loginObj.username && this.loginObj.password && this.loginObj.tenant);
    }
}

(function (ons) {
    var login = null;
    var app = ons.bootstrap('carthesioMobile', ['web2angular', 'ui.router']);
    app.controller('AppController', function($scope, $rootScope, $http){
        login = new Login($http, $rootScope);
        $rootScope.showLogin = false;
        if (login.hasInfo()) {
            login.login(function(x){
                $rootScope.serverStatus = x.data.serverStatus || 'ready';
                $rootScope.options = x.data
                $rootScope.showLogin = false;
            }, function(x) {
                $rootScope.showLogin = true;
            });
        } else {
            $rootScope.showLogin = true;
        }
    });

    app.controller('loginController', function($scope, $rootScope) {
        $scope.loginObj = login.loginObj;
        $scope.errors = false;
        this.login = function() {
            login.login(function(x){
                $rootScope.options = x.data;
                $rootScope.showLogin = false;
            }, function(x) {
                $rootScope.showLogin = true;
                $scope.errors = x.data.error;
            })
        }
    });

    app.controller('condominio', function($scope, $rootScope, w2pResources) {
        $scope.condomini = [];
        w2pResources.list('condominio', {}, null, function(c) { 
            $scope.condomini = c;
            if (c.length === 1) {
                $rootScope.ilCondominio = c[0];
            } else {
                console.warn('trovati ' + c.length + ' condomini');
            }
        });
    });

    ons.ready(function() {
        console.log('ONS ready')
    });    

})(ons);

