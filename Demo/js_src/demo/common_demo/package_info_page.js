"use strict";
/*
 * @Author: SealyZhong
 * @CreateDate: 2020/11/10
 * @ModifyDate: 2020/11/11
 * @Description: 入口页
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyPackageInfoPage = void 0;
const fs = require("flutter_sdk");
class MyPackageInfoPage extends fs.StatefulWidget {
    createState() {
        return new _MyPackageInfoPage(this);
    }
    static new() {
        return new MyPackageInfoPage();
    }
}
exports.MyPackageInfoPage = MyPackageInfoPage;
class _MyPackageInfoPage extends fs.WidgetState {
    async _updatePackageInfo() {
        await fs.PackageInfo.updateInfo();
        this.setState();
    }
    build(context) {
        return fs.Scaffold.new({
            appBar: fs.AppBar.new({
                title: fs.Text.new("包信息"),
            }),
            body: fs.Center.new({
                child: fs.Column.new({
                    mainAxisAlignment: fs.MainAxisAlignment.center,
                    children: [
                        fs.Text.new("appName: " + String(fs.PackageInfo.appName)),
                        fs.Text.new("buildNumber: " + String(fs.PackageInfo.buildNumber)),
                        fs.Text.new("packageName: " + String(fs.PackageInfo.packageName)),
                        fs.Text.new("version: " + String(fs.PackageInfo.version)),
                    ]
                }),
            }),
        });
    }
}
