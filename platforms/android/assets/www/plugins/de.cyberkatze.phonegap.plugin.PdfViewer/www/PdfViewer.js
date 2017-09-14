cordova.define("de.cyberkatze.phonegap.plugin.PdfViewer.PdfViewer", function(require, exports, module) {
window.openPDF = function (parameters, callback) {
    cordova.exec(function () {
    }, function () {
    }, "PdfViewer", "openPDF", [ parameters ]);
};

});
