"use strict";
/*
 * @Author: SealyZhong
 * @CreateDate: 2020/11/10
 * @ModifyDate: 2020/11/11
 * @Description: Google Counter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyEasyRefreshMaterialDemoPage = void 0;
const icon_data_1 = require("demo/model/icon_data");
const fs = require("flutter_sdk");
const tl = require("flutter_third_library");
class MyEasyRefreshMaterialDemoPage extends fs.StatefulWidget {
    createState() {
        return new _MyEasyRefreshMaterialDemoPageState(this);
    }
}
exports.MyEasyRefreshMaterialDemoPage = MyEasyRefreshMaterialDemoPage;
class _MyEasyRefreshMaterialDemoPageState extends fs.WidgetState {
    constructor() {
        super(...arguments);
        this.refreshController = new tl.EasyRefreshController();
        this._maxCount = icon_data_1.MyIconData.cupertinoIcons.length;
        this._count = 20;
    }
    //重构
    build(context) {
        var that = this;
        return new fs.Scaffold({
            appBar: new fs.AppBar({
                title: new fs.Text("Material Demo"),
            }),
            body: new tl.EasyRefresher({
                enableControlFinishRefresh: true,
                enableControlFinishLoad: true,
                controller: this.refreshController,
                header: new tl.EasyRefreshMaterialHeader(),
                footer: new tl.EasyRefreshMaterialFooter({ isNoMoreText: true }),
                onRefresh: function () {
                    fs.Loading.show({ info: "数据加载中...", alignment: fs.Alignment.center });
                    fs.Future.delayed(new fs.Duration({
                        seconds: 2
                    }), function () {
                        that._count = 20;
                        fs.Loading.dismiss();
                        that.refreshController.finishRefresh({ success: true, noMore: false });
                        that.refreshController.finishLoad({ success: true, noMore: that._count >= that._maxCount });
                        that.setState();
                    });
                },
                onLoad: function () {
                    fs.Loading.show({ info: "数据加载中...", alignment: fs.Alignment.center });
                    fs.Future.delayed(new fs.Duration({
                        seconds: 2
                    }), function () {
                        that._count = that._count + 20;
                        if (that._count >= that._maxCount) {
                            that._count = that._maxCount;
                        }
                        fs.Loading.dismiss();
                        that.refreshController.finishLoad({ success: true, noMore: that._count >= that._maxCount });
                        that.setState();
                    });
                },
                child: fs.ListView.builder({
                    itemCount: this._count,
                    itemBuilder: (context, index) => {
                        var model = icon_data_1.MyIconData.cupertinoIcons[index];
                        return new fs.Container({
                            padding: fs.EdgeInsets.all(10),
                            child: new fs.Row({
                                children: [
                                    new fs.Icon(model.value),
                                    new fs.SizedBox({ width: 10 }),
                                    new fs.Expanded({
                                        child: new fs.Text(model.name, { overflow: fs.TextOverflow.ellipsis, style: new fs.TextStyle({ fontSize: 16 }) }),
                                    }),
                                ]
                            })
                        });
                    }
                }),
            }),
        });
    }
}
