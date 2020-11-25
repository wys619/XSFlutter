"use strict";
/*
 * @Author: SealyZhong
 * @CreateDate: 2020/11/10
 * @ModifyDate: 2020/11/11
 * @Description: Google Counter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyCounterPage = void 0;
const js_flutter_sdk_1 = require("./js_flutter_sdk");
class MyCounterPage extends js_flutter_sdk_1.JSStatefulWidget {
    createState() {
        return new _MyCounterPage();
    }
}
exports.MyCounterPage = MyCounterPage;
class _MyCounterPage extends js_flutter_sdk_1.JSWidgetState {
    constructor() {
        super(...arguments);
        this._counter = 0;
    }
    //计数器
    _incrementCounter() {
        this._counter++;
        this.setState();
    }
    //重构
    build() {
        return js_flutter_sdk_1.Scaffold.new({
            appBar: js_flutter_sdk_1.AppBar.new({
                title: js_flutter_sdk_1.Text.new("Google Counter"),
            }),
            body: js_flutter_sdk_1.Center.new({
                child: js_flutter_sdk_1.Column.new({
                    mainAxisAlignment: js_flutter_sdk_1.MainAxisAlignment.center,
                    children: [
                        js_flutter_sdk_1.FlutterLogo.new({ size: 64 }),
                        js_flutter_sdk_1.Text.new("This example is developed using JS."),
                        js_flutter_sdk_1.Text.new(String(this._counter), {
                            style: js_flutter_sdk_1.TextStyle.new({
                                fontWeight: js_flutter_sdk_1.FontWeight.bold,
                                fontStyle: js_flutter_sdk_1.FontStyle.italic,
                                fontSize: 24,
                                color: js_flutter_sdk_1.Colors.red,
                            }),
                        }),
                    ],
                }),
            }),
            floatingActionButton: js_flutter_sdk_1.FloatingActionButton.new({
                onPressed: this._incrementCounter.bind(this),
                child: js_flutter_sdk_1.Icon.new(js_flutter_sdk_1.Icons.add),
            }),
        });
    }
}