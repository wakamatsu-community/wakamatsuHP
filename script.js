(function loadModularScript() {
    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    moduleScript.src = "js/main.js";
    document.head.appendChild(moduleScript);
})();
