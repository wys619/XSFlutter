

import homeWidget = require("./counter_page");
import { JSFlutterApp, JSFramework, JSLog } from "./js_flutter_sdk";

class MyApp extends JSFlutterApp{
    
    ///子类重写,当Flutter通过
    ///XSFlutter.getInstance().navigatorPushWithName("JSWidgetHomePage", ...);push页面时，
    ///在这里根据widgetName 创建你自己的Widget
    ///@overrite
    createJSWidgetWithName(widgetName?:string) {
        JSLog.log("Widget Name:"+widgetName);
        switch (widgetName) {
            case "MyCounterPage": {
                return new homeWidget.MyCounterPage(widgetName);
            }
        }

    }
}

function main(releaseMode?:boolean) {
    JSLog.log("main() start up ");
    let app = new MyApp();
    JSFramework.runApp(app);
}