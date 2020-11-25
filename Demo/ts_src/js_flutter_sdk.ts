/*
 * @Author: SealyZhong
 * @CreateDate: 2020/11/10
 * @ModifyDate: 2020/11/11
 * @Description: JS Flutter SDK
 */

// @ts-ignore：dart_sdk
import dart_sdk = require("dart_sdk"); 
const core = dart_sdk.core;

//#region ******** Base Class *********

//****** VoidCallback ******
export type VoidCallback = () => void;

//****** VoidValueChangedString ******
export type VoidValueChangedString = (value:string) => void;

//****** VoidValueChangedBoolean ******
export type VoidValueChangedBoolean = (value:boolean) => void;

//****** VoidValueChangedNumber ******
export type VoidValueChangedNumber = (value:number) => void;

//****** TODO JSWidget Mirror Mgr ******
export class JSWidgetMirrorMgr {
  mirrorIDFeed:number;
  mirrorObjMap:Map<string,any>;
  static instance?:JSWidgetMirrorMgr;

  constructor() {
    this.mirrorIDFeed = 0;
    this.mirrorObjMap = new Map();
  }

  //将对象加入数组并返回 ID字符串
  generateID(obj:DartClass):string {
    const d = ++ this.mirrorIDFeed;
    const idstring = String(d);
    this.mirrorObjMap.set(idstring, obj);
    return idstring;
  }

  //使用ID列表删除对象
  removeMirrorObjects(mirrorIDList:Array<string>):void{
    for (let mirrorID in mirrorIDList) {
      this.mirrorObjMap.delete(mirrorID);
    }
  }

  //通过ID 获取对象
  getMirrorObj(mirrorID:string) {
    return this.mirrorObjMap.get(mirrorID);
  }

  //单例化
  static getInstance():JSWidgetMirrorMgr {
    if (!this.instance) {
      this.instance = new JSWidgetMirrorMgr();
    }
    return this.instance;
  }
}

//****** TODO JSCallArgs ******
interface JSCallArgsConfig {
  widgetID?:string;
  mirrorID?:string;
  className?:string;
  funcName?:string;         
  args?:Map<string,any>;
}
export class JSCallArgs {
  widgetID?:string;
  mirrorID?:string;
  className?:string;
  funcName?:string;
  args?:Map<string,any>;
  /**
   * @param config config: 
    {
      widgetID?:string, 
      mirrorID?:string, 
      className?:string, 
      funcName?:string,        
      args?:Map<string,any>
    }
   */
  static new(config:JSCallArgsConfig):JSCallArgs{
    var v = new JSCallArgs();
    if(config!=null && config!=undefined){
      v.widgetID = config.widgetID;
      v.mirrorID = config.mirrorID;
      v.className = config.className;
      v.funcName = config.funcName;
      v.args = config.args;
    }
    return v;
  }
}

//flutter 中 非widget继承 DartClass
export class DartClass extends core.Object {
  className:string;         //类名
  constructorName?:string;  //子类名
  mirrorID?:string;         //事件ID

  constructor() {
    super();
    this.className = this.constructor.name;
  }

  //创建绑定事件ID
  createMirrorID():void {
    this.mirrorID = JSWidgetMirrorMgr.getInstance().generateID(this);
    core.print("createMirrorID: mirrorID : " + this.mirrorID);
  }
}

//flutter Widget继承Widget
export class FlutterWidget extends DartClass {
  
  //在生成json前调用
  //用于list delegate 等的items build
  //用于widget有类似onTab等响应函数变量，在此转换成callbackid,
  //但注意，delegate中确实需要funtion,要转不需ID的，不要调用super.preBuild
  preBuild(jsWidgetHelper:any, buildContext?:JSBuildContext) {
    //把callback 换成callbackID
    for (let k in this) {
      let v = this[k];
      if (typeof v == "function") {
        this[k] = jsWidgetHelper.buildingCreateCallbackID(v);
      }
    }
  }
}

//****** ShapeBorder ******
export class ShapeBorder extends DartClass {}


//#endregion


//#region ******** Framework ********
export class JSBridge {

  ///js->native->flutter 顶层通用调用通道
  static invokeFlutterCommonChannel(basicMethodCall:any, callback?:any) {
    // @ts-ignore：dart_sdk
    mxfJSBridgeInvokeFlutterCommonChannel(basicMethodCall.encodeJSON(), function (resultStr:string) {

      if (callback) {
        callback(resultStr);
      }

      JSLog.debug("invokeFlutterCommonChannel: callback: " + resultStr);
    });
  }

  ///mirrorObj sys
  ///调用Logic mirrorObj的函数
  ///*重要区分： JS Logic MirrorObj的生命周期JS侧控制，由Native Weak Ref辅助完成释放
  static createMirrorObj(flutterCallArgs:any, mirrorID:any, needMonitordGCValue:any) {

    let basicMethodCall = JSMethodCall.new("JSBridgeCreateMirrorObj", flutterCallArgs);
    JSBridge.invokeFlutterCommonChannel(basicMethodCall);

    //监控jsvalue 释放，同步释放flutter侧对象

    // @ts-ignore：dart_sdk
    if (typeof(mxfAddJSValueToMirrorObjGCMap) !== "undefined") {
      // @ts-ignore：dart_sdk
      mxfAddJSValueToMirrorObjGCMap(mirrorID, needMonitordGCValue);
    }
  }

  static onFlutterInvokeJSCommonChannel(messageStr:string) {

    JSLog.debug("JSBridge.onFlutterInvokeJSCommonChannel: " + messageStr);

    let args = JSON.parse(messageStr);

    let method = args["method"];
    let callArgs = args["arguments"];

    // @ts-ignore：dart_sdk
    let fun = this[method];

    if (fun != null) {
      return fun.call(this, callArgs);
    } else {
      JSLog.log("JSBridge.onFlutterInvokeJSCommonChannel: error:fun == null" + args);
      return null;
    }

  }

  //flutter->js invokeJSMirrorObj
  static invokeJSMirrorObj(args:any) {

    let mirrorID = args["mirrorID"];
    let funcName = args["funcName"];
    let callbackID = args["callbackID"];
    let funArgs = args["args"];

    //TODO: call mirroObj Fun
    JSCallbackMgr.getInstance().invokeCallback(callbackID, funArgs)
  }

  static invokeMirrorObjWithCallback(flutterCallArgs:any, callback:any) {

    let basicMethodCall = JSMethodCall.new("JSBridgeInvokeMirrorObjWithCallback", flutterCallArgs);
    JSBridge.invokeFlutterCommonChannel(basicMethodCall, callback);
  }

}


// @ts-ignore：dart_sdk
globalThis.mxfJSBridgeInvokeJSCommonChannel = function (messageStr) {
  JSBridge.onFlutterInvokeJSCommonChannel(messageStr);
}

//JSFlutterApp 基类，用于和Native交互
//开发者需要继承XSFlutterApp，重载createJSWidgetWithName函数，根据WidgetName创建框架需要的Widget
export class JSFlutterApp {
  name?:string;
  initialRoute?:string;
  rootWidget?:JSBaseWidget;
  constructor(name?:string, initialRoute?:string) {
    this.name = name;
    this.initialRoute = initialRoute;

    //App的rootWidget是个虚拟Widget，负责管理push的Widget或runAPP 的Widget
    this.rootWidget = new JSStatelessWidget("RootWidget");
    this.rootWidget.helper?.setupAsRootWidget();

  }

  run() {
    this.runWithName(this.initialRoute);
  }


  runWithName(name?:string) {
    let w = this.createJSWidgetWithName(name);
    if(w!=null && w!=undefined){
    this.runApp(w);
    }
  }

  ///子类需要重载
  ///当Flutter通过XSFlutter.getInstance().navigatorPushWithName("JSWidgetHomePage",...);
  ///push页面时，在这里根据widgetName 创建你自己的Widget
  createJSWidgetWithName(widgetName?:string) {

  }

  //Flutter通过XSFlutter.getInstance().navigatorPushWithName("JSWidgetHomePage",...);push页面时,会调用到此函数
  navigatorPushWithName(widgetName?:string, widgetID?:string, args?:any) {

    let w = this.createJSWidgetWithName(widgetName);
    if(w!=null && w!=undefined){
    this.setupWidget(w, widgetName, widgetID, args);

    this.navigatorPush(w, args);
    }
  }

  setupWidget(widget?:any, widgetName?:string, widgetID?:string, args?:any) {
    //设置widgetID
    if(widget!=null && widget!=undefined && widgetID!=null && widgetID!=undefined ){
      widget.widgetID = widgetID;
    }
  }

  //这个接口暂时不完备，暂不要使用，要在JS侧创建setInheritedInfo，参照navigatorPush
  ///JS侧入口API
  //创建XSJSWidget，调用build 创建jsonWidgetTree，调用Flutter runApp 重新加载Flutter根页面
  runApp(widget:any) {

    //这个接口暂时不完备，要在JS侧创建setInheritedInfo，参照navigatorPush

    let bc = JSBuildContext.new(widget);
    widget.buildContext = bc;

    this.rootWidget?.helper?.addChildWidget(widget);

    let app = this;
    this.buildRootWidget(widget);
  }

  ///JS侧入口API
  //当Flutter层 PageRoute(builder: (context) =>  被调用时，创建XSJSWidget，build后调用rebuild界面
  navigatorPush(widget:any, args?:any) {

    let bc = JSBuildContext.new(widget);
    bc.setInheritedInfo(args);
    widget.buildContext = bc;

    this.rootWidget?.helper?.addChildWidget(widget);

    widget?.helper?.callFlutterRebuild();
  }

  buildRootWidget(widget:JSBaseWidget) {
    JSLog.log("buildRootWidget ::" + widget?.getWidgetInfo());
    let widgetData = JSWidgetHelper.buildWidgetData(widget);

    JSFramework.callFlutterReloadApp(this, widgetData);
  }


  //flutter->js channel
  nativeCall(args?:any) {
    JSLog.log("XSFlutterApp:nativeCall" + args);

    let method = args["method"];
    let callArgs = args["arguments"];

    // @ts-ignore：dart_sdk
    let fun = this[method];

    if (fun != null) {
      return fun.call(this, callArgs);
    } else {
      JSLog.log("XSFlutterApp:nativeCall error:fun == null" + args);
      return null;
    }
  }

  flutterCallFrequencyLimitCallList(args?:any) {
    if (args) {
      args.map(function (callArgs?:any) {
        // @ts-ignore：dart_sdk
        this.nativeCall(callArgs);
      }.bind(this));
    }
  }

  flutterCallOnEventCallback(args?:any) {
    return this.rootWidget?.helper?.onEventCallback(args);
  }

  flutterCallNavigatorPushWithName(args?:any) {
    let widgetName = args["widgetName"];
    let widgetID = args["widgetID"];

    this.navigatorPushWithName(widgetName, widgetID, args);
  }

  flutterCallOnBuildEnd(args?:any) {
    this.rootWidget?.helper?.onBuildEnd(args);
  }

  flutterCallOnDispose(args?:any) {
    let widgetID = args["widgetID"];

    if (this.rootWidget && this.rootWidget.widgetID == widgetID) {
    }

    this.rootWidget?.helper?.onDispose(args);

    let mirrorObjIDList = args["mirrorObjIDList"];
    JSWidgetMirrorMgr.getInstance().removeMirrorObjects(mirrorObjIDList);
  }

  flutterCallOnMirrorObjInvoke(args?:any) {
    var mirrorObjID = args["mirrorID"];
    var functionName = args["functionName"];
    var args = args["args"];
    var mirrorObj = JSWidgetMirrorMgr.getInstance().getMirrorObj(
      mirrorObjID
    );
    if (mirrorObj != null) {
      mirrorObj[functionName](args);
    }
  }
}

///JSAPI
///mirrorObj sys
///flutter ->native ->js
export class JSFramework {
  static currentJSApp:any = null;

  //全局函数
  static runApp(app:any) {
    JSFramework.callNativeSetCurrentJSApp(app);
  }

  static callNativeSetCurrentJSApp(app:any) {
    JSFramework.currentJSApp = app;
    // @ts-ignore：系统原生对象
    XSNativeJSFlutterApp.setCurrentJSApp(app);
  }

  static callFlutterReloadApp(app:any, widgetData:string) {
    JSFramework.currentJSApp = app;
    // @ts-ignore：系统原生对象
    XSNativeJSFlutterApp.callFlutterReloadApp(app, widgetData);
  }

  static callFlutterWidgetChannel(method:string, args:string) {
    // @ts-ignore：系统原生对象
    XSNativeJSFlutterApp.callFlutterWidgetChannel(method, args);
  }

  ///TODO: 优化
  ///调用和UI相关的mirrorObj的函数
  ///*重要区分： UIMirrorObj的生命周期和Flutter Widget控制，由Dart侧Dispose时完成释放
  static invokeFlutterFunction(callArgs:any) {
    JSFramework.callFlutterWidgetChannel("invoke", JSON.stringify(callArgs));
  }

  ///TODO: 优化
  ///github merge
  static invokeCommonFlutterFunction(callArgs:any) {
    JSFramework.callFlutterWidgetChannel("invokeCommon", JSON.stringify(callArgs));
  }
}

//****** TODO 原生日志输出 ******
export class JSLog {
  static setLogLev(lev:number) {
    JSLog.logLev = lev;
  }
  
  static printLog(log:string){
    var prefix:string="[JS]: ";
    if(JSLog.logLev==0){
      prefix="[JS-Debug]: ";
    }else if(JSLog.logLev==2){
      prefix="[JS-Error]: ";
    }
    // @ts-ignore：原生系统函数
    XSNativeLog(prefix + log);
  }
  static debug(log:string) {
    if(JSLog.logLev!=0){
      JSLog.logLev=0;
    }
    this.printLog(log);
  }

  static log(log:string) {
    if(JSLog.logLev!=1){
      JSLog.logLev=1;
    }
    this.printLog(log);
  }


  static error(log:string) {
    if(JSLog.logLev!=2){
      JSLog.logLev=2;
    }
    this.printLog(log);
  }

  static LogLevDebug = 0;
  static LogLevInfo = 1;
  static LogLevError = 2;
  static logLev = JSLog.LogLevDebug;
}

//****** TODO 方法调用 ******
export class JSMethodCall {
  name?:string;
  args?:Map<string,any>;

  encodeJSON() {
    return JSON.stringify({ "funcName": this.name, "args": this.args });
  }

  static new(name:string,args?:Map<string,any>){
    var v = new JSMethodCall();
    v.name = name;
    v.args = args;
    return v;
  }
}

//****** TODO 全局callbak管理器 ******
export class JSCallbackMgr {
  callbackIDFeed:number;

  callbackID2fun?:Map<string,any>;
  static instance:JSCallbackMgr;

  constructor() {
    this.callbackIDFeed = 0;
    this.callbackID2fun = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new JSCallbackMgr();
    }
    return this.instance;
  }

  generateID() {
    let d = ++this.callbackIDFeed;
    return String(d);
  }

  createCallbackID(callback:any) {
    let callbackID = this.generateID();
    this.callbackID2fun?.set(callbackID,callback);
    return callbackID;
  }

  invokeCallback(callbackID:string, args:any) {
    let callback = this.findCallback(callbackID);
    callback(args);
  }

  findCallback(callbackID:string) {
    return this.callbackID2fun?.get(callbackID);
  }

  removeCallback(callbackID:string) {
    this.callbackID2fun?.delete(callbackID);
  }
}

//****** TODO JSBuildContext 和flutter BuildContext 保持一致的编程方式 ******
export class JSBuildContext {
  widget?:JSBaseWidget;
  parentBuildContext?:JSBuildContext;
  inheritedInfo?:any;
  static new(widget:JSBaseWidget, parentBuildContext?:JSBuildContext){
    var v = new JSBuildContext();
    v.widget = widget;
    v.widget.buildContext = v;
    v.parentBuildContext = parentBuildContext;
    v.inheritedInfo = {};
    return v;
  }

  static inheritBuildContext(widget:JSBaseWidget, buildContext?:JSBuildContext) {
    var context = JSBuildContext.new(widget, buildContext);
    context.inheritedInfo = buildContext?.inheritedInfo;
    return context;
  }

  setInheritedInfo(args?:any) {
    this.inheritedInfo = args;
  }
}

//****** TODO JSWidgetHelper ******
export class JSWidgetHelper {
  widget:JSBaseWidget;
  constructor(widget:JSBaseWidget) {
    this.widget = widget;
  }

  setState(fun?:any) {
    this.widget.state?.setState(fun);
  }

  //util api
  //building

  static buildWidgetData(jsWidget:JSBaseWidget) {

    JSLog.log("buildWidgetData ::" + jsWidget.getWidgetInfo());

    let widgetDataStr = JSON.stringify(jsWidget, function (key, value) {

      let newValue = value;

      if (value instanceof JSStatefulWidget || value instanceof JSStatelessWidget) {
        // 解决widget生成时不调用构造方法的问题
        if (value.helper == null) {
          value.className = value instanceof JSStatefulWidget ? "JSStatefulWidget" : "JSStatelessWidget";
          initJSWidgetData(value);
        }

        if (value != jsWidget) {
          value.buildContext = JSBuildContext.inheritBuildContext(value, jsWidget.buildContext);
          //TODO:FIXME addChildWidget逻辑，这里局部刷新，会有两份Widget数据，但功能正常
          //Widget 的子Widget 没有层级关系，平铺在jsWidget
          jsWidget.helper?.addChildWidget(value);
        }

        //如果是JSWidget类需要调用一下build，返回build内容
        newValue = value.helper?.buildWidgetTree();
      }


      // 遍历处理Symbol的key转成String放入Json中
      if (newValue && typeof newValue === 'object') {
        var objectSymbols = Object.getOwnPropertySymbols(newValue);
        if (objectSymbols.length > 0) {
          var replacement = new Map();

          var len = objectSymbols.length;
          for (var i = 0; i < len; ++i) {
            // @ts-ignore：description
            var key = objectSymbols[i].description;
            var value = newValue[objectSymbols[i]];
            replacement.set(key,value);
            //replacement[key] = value;
          }

          return replacement;
        }
      }

      return newValue;
    });

    return widgetDataStr;
  }

  buildWidgetTree() {
    this.widget.buildWidgetDataSeq = String(
      ++this.widget.buildWidgetDataSeqFeed
    );

    let tempWidgetTree = JSWidgetTree.new(
      this.widget.buildWidgetDataSeq
    );
    tempWidgetTree.ownerWidget = this.widget;

    this.widget.buildingWidgetTree = tempWidgetTree;
    JSLog.log("JSWidget buildWidgetTree ::" + this.widget.getWidgetInfo());

    let tempWidgetTreeObjMap;
    if (this.widget instanceof JSStatelessWidget) {
      tempWidgetTreeObjMap = this.widget.build(this.widget.buildContext);
    } else if (this.widget instanceof JSStatefulWidget) {
      //必须在Build的时候才创建State
      if (this.widget.state==null && this.widget.state==undefined) {
        this.widget.state = this.widget.createState();
        this.widget.state.widget = this.widget;
        this.widget.state.initState();
      }
      tempWidgetTreeObjMap = this.widget.state.build(this.widget.buildContext);
    }

    //如果Build的root wiget 是JSStatelessWidget，则直接展开，优化性能
    if (tempWidgetTreeObjMap instanceof JSStatelessWidget) {
      tempWidgetTreeObjMap = tempWidgetTreeObjMap.build(this.widget.buildContext);
    }

    //tempWidgetTree.widgetTreeObjMap = tempWidgetTreeObjMap; //不做diff不用保存，优化内存

    this.preBuildJson(tempWidgetTree, tempWidgetTreeObjMap);

    //加入缓存map
    this.widget.buildSeq2WTreeMap?.set(tempWidgetTree.buildWidgetDataSeq,tempWidgetTree);

    //json实际包含的字段
    let jsonMap = {
      key: this.widget.key,
      name: this.widget.name,
      className: this.widget.className,
      widgetID: this.widget.widgetID,
      buildWidgetDataSeq: this.widget.buildWidgetDataSeq,
      navPushingWidgetID: this.widget.navPushingWidgetID,
      widgetData: tempWidgetTreeObjMap,
      enableProfile: this.widget.enableProfile
    };

    return jsonMap;
  }

  preBuildJson(widgetTree:JSWidgetTree, widgetTreeObjMap:any) {

    //JSLog.log("preBuildJson:" + flutterWidget);
    if (!(widgetTreeObjMap instanceof Object)) {
      return;
    }

    //JSStatefulWidget不处理
    if (widgetTreeObjMap instanceof JSStatefulWidget) {
      return;
    }

    if (widgetTreeObjMap instanceof FlutterWidget) {
      //ListView等类似需要提前处理build的FlutterWidget 有preBuild 函数
      widgetTreeObjMap.preBuild(this, this.widget.buildContext);
    }

    for (let p in widgetTreeObjMap) {

      let value = widgetTreeObjMap[p];
      //如果Build的 wiget tree 里有节点是JSStatelessWidget，则直接展开，优化性能
      if (value instanceof JSStatelessWidget) {
        value = value.build(this.widget.buildContext);
        widgetTreeObjMap[p] = value;
      }

      this.preBuildJson(widgetTree, value);
    }
  }

  //buildingCreateCallbackID 只允许building过程中调用，不是对外API
  buildingCreateCallbackID(callback:any) {
    //* XSFlutter beta 0.1.0开始，框架不在帮助上层代码绑定this，开发者需要自己绑定需要的对象 
    //callback = callback.bind(this.widget);
    return this.widget.buildingWidgetTree?.createCallbackID(
      callback
    );
  }

  setupAsRootWidget() {
    this.widget.buildingWidgetTree = JSWidgetTree.new("1");
    this.widget.currentWidgetTree = this.widget.buildingWidgetTree;

  }

  addChildWidget(jsWidget:JSBaseWidget) {
    jsWidget.parentWidget = this.widget;
    this.widget.buildingWidgetTree?.childrenWidget.set(jsWidget.widgetID,jsWidget);
  }

  removeChildWidget(jsWidget:JSBaseWidget) {
    if (
      this.widget.currentWidgetTree &&
      this.widget.currentWidgetTree.childrenWidget
    ) {
      this.widget.currentWidgetTree.childrenWidget.delete(jsWidget.widgetID);
    }
  }

  //js->flutter
  callFlutterRebuild() {

    JSLog.log("callFlutterRebuild ::" + this.widget.getWidgetInfo());
    let startEncodeData = (new Date()).valueOf();
    let widgetData = JSWidgetHelper.buildWidgetData(this.widget);
    let startTransferData = (new Date()).valueOf();

    if (this.widget.enableProfile) {
      let profileInfo = new Map();
      profileInfo.set("startEncodeData",startEncodeData);      
      profileInfo.set("startTransferData",startTransferData);
      profileInfo.set("transferDataLen",widgetData.length);
      this.widget.profileInfo = profileInfo;
    }


    //rebuild and confirm 配对
    this.confirmCurrentWidgetTree();
    //call flutter setState
    JSFramework.callFlutterWidgetChannel("rebuild", widgetData);
  }

  //0.1.0 2020-4-2 修改为不经过dart侧buildend确认，当发送rebuild或等价构建UI调用后
  //直接确认CurrentTree，目的是可以聚合延迟发送buildend
  confirmCurrentWidgetTree() {
    this.widget.preWidgetTree = this.widget.currentWidgetTree;
    this.widget.currentWidgetTree = this.widget.buildingWidgetTree;
  }


  //flutter -> js
  onEventCallback(args:any) {
    let callID = args["callID"]; //   widgetID/callID 格式 ： "1313/3434"
    if (callID == null) {
      return;
    }
    let arr = callID.split("/");

    let widgetID = arr[0];

    let buildWidgetDataSeq = args["buildSeq"];
    let callArgs = args["args"];

    let jsWidget = this.findWidgetWithWidgetID(widgetID);

    if (jsWidget != null) {
      return jsWidget?.helper?.invokeCallback(buildWidgetDataSeq, callID, args["args"]);
    } else {
      JSLog.error(
        "onEventCallback error: jsWidget == null onEventCallback(args:" + args
      );
    }
  }

  findWidgetWithWidgetID(widgetID:string) :JSBaseWidget | undefined  {
    if (this.widget.widgetID == widgetID) {
      return this.widget;
    }

    //先在currentTree里找，一般这里能找到
    let widgetTree = this.widget.currentWidgetTree;

    if (widgetTree != null) {
      let w = widgetTree.childrenWidget.get(widgetID);
      if (w) {
        return w;
      }

      for (let k in widgetTree.childrenWidget) {
        let jsWidget = widgetTree.childrenWidget.get(k);
        w = jsWidget?.helper?.findWidgetWithWidgetID(widgetID);
        if (w) {
          return w;
        }
      }
    }

    //找不到就遍历treemap，为了去掉 buildend 回调确认WidgetTree的过程
    for (let seq in this.widget.buildSeq2WTreeMap) {

      if (this.widget.currentWidgetTree && this.widget.currentWidgetTree.buildWidgetDataSeq == seq) {
        continue;
      }

      let widgetTree = this.widget.buildSeq2WTreeMap.get(seq);
      if (widgetTree != null) {
        let w = widgetTree.childrenWidget.get(widgetID);
        if (w) {
          return w;
        }

        for (let k in widgetTree.childrenWidget) {
          let jsWidget = widgetTree.childrenWidget.get(k);
          w = jsWidget?.helper?.findWidgetWithWidgetID(widgetID);
          if (w) {
            return w;
          }
        }
      }
    }

    //查找被自己push的widgets
    for (let k in this.widget.navPushedWidgets) {
      let jsWidget = this.widget.navPushedWidgets.get(k);
      let w = jsWidget?.helper?.findWidgetWithWidgetID(widgetID);
      if (w) {
        return w;
      }
    }

    return undefined;
  }

  invokeCallback(buildWidgetDataSeq:any, callID:any, args:any) {

    JSLog.log("JSWidget invokeCallback ::" + this.widget.getWidgetInfo() + " buildWidgetDataSeq: " + buildWidgetDataSeq + " callID: " + callID);

    if (this.widget.currentWidgetTree && this.widget.currentWidgetTree.buildWidgetDataSeq != buildWidgetDataSeq) {
      JSLog.error(
        "JSWidget:invokeCallback:this.widget.currentWidgetTree.buildWidgetDataSeq(" + this.widget.currentWidgetTree.buildWidgetDataSeq + ")  != buildWidgetDataSeq(" + buildWidgetDataSeq + ") " +
        " callID: " +
        callID
      );

      if (this.widget.preWidgetTree && this.widget.preWidgetTree.buildWidgetDataSeq == buildWidgetDataSeq) {
        JSLog.error(
          "JSWidget:invokeCallback:this.widget.preWidgetTree.buildWidgetDataSeq(" + this.widget.preWidgetTree.buildWidgetDataSeq + ")  == buildWidgetDataSeq(" + buildWidgetDataSeq + ") " +
          " callID: " +
          callID
        );

      }

      if (this.widget.buildingWidgetTree && this.widget.buildingWidgetTree.buildWidgetDataSeq == buildWidgetDataSeq) {
        JSLog.error(
          "JSWidget:invokeCallback:this.widget.buildingWidgetTree.buildWidgetDataSeq(" + this.widget.buildingWidgetTree.buildWidgetDataSeq + ")  == buildWidgetDataSeq(" + buildWidgetDataSeq + ") " +
          " callID: " +
          callID
        );

      }

      return null;
    }

    if (this.widget.currentWidgetTree && this.widget.currentWidgetTree.findCallback(callID)) {
      return this.widget.currentWidgetTree.invokeCallback(callID, args);
    }
    else {
      // @ts-ignore：容错处理
      JSLog.error(
        "JSWidget:invokeCallback: 容错搜索所有BuildTree，this.widget.buildingWidgetTree.buildWidgetDataSeq(" + this.widget?.buildingWidgetTree?.buildWidgetDataSeq + ")  == buildWidgetDataSeq(" + buildWidgetDataSeq + ") " +
        " callID: " +
        callID
      );
      for (let seq in this.widget.buildSeq2WTreeMap) {
        let tree = this.widget.buildSeq2WTreeMap.get(seq);

        if (tree?.findCallback(callID)) {
          return tree.invokeCallback(callID, args);
        }

      }
    }

  }


  onBuildEnd(args:any) {
    let widgetID = args["widgetID"];
    let buildWidgetDataSeq = args["buildSeq"];
    let jsWidget = this.findWidgetWithWidgetID(widgetID);

    if (jsWidget != null) {
      let profileInfo = args["profileInfo"];
      jsWidget?.helper?.onFlutterBuildEnd(buildWidgetDataSeq, profileInfo);
    } else {
      JSLog.error("onBuildEnd error: jsWidget == null widgetID: " + widgetID + " buildWidgetDataSeq: " + buildWidgetDataSeq);
    }
  }

  onFlutterBuildEnd(buildWidgetDataSeq:any, profileInfo:any) {

    let tree = this.widget.buildSeq2WTreeMap?.get(buildWidgetDataSeq);

    if (tree != null) {
      this.widget.preWidgetTree = this.widget.currentWidgetTree;
      this.widget.currentWidgetTree = tree;

      JSLog.log("JSWidget onFlutterBuildEnd success::" + this.widget.getWidgetInfo() + " buildWidgetDataSeq: " + buildWidgetDataSeq);

      this.clearWidgetTree(buildWidgetDataSeq);
    } else {
      // @ts-ignore：this.widget.buildSeq2WTreeMap
      JSLog.error("JSWidget onFlutterBuildEnd fail buildSeq2WTreeMap.keys: [" + Object.keys(this.widget.buildSeq2WTreeMap).join("|") + "]::" + this.widget.getWidgetInfo() + " buildWidgetDataSeq: " + buildWidgetDataSeq);
    }

    this.widget.setProfileInfo(profileInfo);

    if (this.widget instanceof JSStatelessWidget) {
      this.widget.onBuildEnd();
    } else if (this.widget instanceof JSStatefulWidget) {
      this.widget.state.onBuildEnd();
    }
  }

  //比buildWidgetDataSeq小的tree 可以清理掉了
  clearWidgetTree(buildWidgetDataSeq:any) {

    let intCurSeq = parseInt(buildWidgetDataSeq);
    let clearSeqs = [];

    for (let seq in this.widget.buildSeq2WTreeMap) {
      let intSeq = parseInt(seq);

      //保留第一次的构建，兼容有些Flutter Widget有不更新Widget内容的bug
      if (intSeq <= 1) {
        continue;
      }

      if (intSeq < intCurSeq) {
        clearSeqs.push(seq);
      }
    }

    for (let i = 0; i < clearSeqs.length; ++i) {
      //JSLog.debug("JSWidget clearWidgetTree::" + this.widget.getWidgetInfo() + " delSeq: " + delSeq);
      this.widget.buildSeq2WTreeMap?.delete(clearSeqs[i]);
    }

  }

  onDispose(args?:any) {
    let widgetID = args["widgetID"];

    let jsWidget = this.findWidgetWithWidgetID(widgetID);

    if (jsWidget != null) {
      jsWidget?.helper?.onFlutterDispose();

      if (jsWidget.parentWidget) {
        //TODO: FIXME listview 滑动，滑出之后再回来，就不响应了，先不删除，依赖顶层Push页面的pop来释放
        //jsWidget.parentWidget.helper.removeChildWidget(jsWidget);
      }

      if (jsWidget.navPushingWidget) {

        jsWidget.navPushingWidget.helper?.removePushingWidget(jsWidget);
      }
    } else {
      JSLog.error("onDispose error: jsWidget == null widgetID " + widgetID);
    }
  }

  onFlutterDispose() {

    JSLog.log("JSWidget onFlutterDispose ::" + this.widget.getWidgetInfo());
    //调用子widget disposeWidget
    if (
      this.widget.currentWidgetTree &&
      this.widget.currentWidgetTree.childrenWidget
    ) {
      for (let k in this.widget.currentWidgetTree.childrenWidget) {
        let widget = this.widget?.currentWidgetTree?.childrenWidget.get(k);
        if (widget) {
          widget?.helper?.onFlutterDispose();
        }
        // this.widget.currentWidgetTree.childrenWidget[k].disposeWidget();
      }
    }

    if (this.widget instanceof JSStatefulWidget) {
      this.widget.state.dispose();
    }
  }

  //js->flutter
  //navigator route
  navigatorPush(jsWidget:JSBaseWidget) {
    // 清空当前widget的navPushedWidgets数据
    for (let i in this.widget.navPushedWidgets) {
      var obj = this.widget.navPushedWidgets.get(i);
      obj?.helper?.onFlutterDispose();

      if (obj?.parentWidget) {
        obj?.parentWidget?.helper?.removeChildWidget(obj);
      }

      if (obj?.navPushingWidget) {
        obj?.navPushingWidget?.helper?.removePushingWidget(obj);
      }
    }

    let startEncodeData = (new Date()).valueOf();
    let widgetData = this.updatePushingWidgetsData(jsWidget);
    let startTransferData = (new Date()).valueOf();

    if (jsWidget.enableProfile) {
      let profileInfo = new Map();
      profileInfo.set('startEncodeData', startEncodeData);
      profileInfo.set('startTransferData', startTransferData);
      profileInfo.set('transferDataLen', widgetData.length);
      jsWidget.profileInfo = profileInfo;
    }

    //call flutter navigatorPush
    JSFramework.callFlutterWidgetChannel("navigatorPush", widgetData);
  }

  navigatorPop() {

    // TODO:fixme找到最上层的top widget
    let topRootWidget = this.findTopRootWidget();
    let widgetID = topRootWidget?.widgetID;
    // @ts-ignore：widgetID
    JSFramework.callFlutterWidgetChannel("navigatorPop", {widgetID});

    if (this.widget.navPushedWidgets && widgetID!=undefined) {
      this.widget.navPushedWidgets.delete(widgetID);
    }
  }

  //留意：这个函数命名是不是应该是removePushedWidget
  removePushingWidget(jsWidget:JSBaseWidget) {
    if (this.widget.navPushedWidgets) {
      this.widget.navPushedWidgets.delete(jsWidget.widgetID);
    }
  }

  updatePushingWidgetsData(jsWidget:JSBaseWidget) {

    JSLog.log("updatePushingWidgetsData WidgetName:" + jsWidget.widgetName);
    //那种根节点不是statewidget的页面 比如Theme
    var newJSWidget;
    if (jsWidget.className != "JSStatefulWidget" && jsWidget.className != "JSStatelessWidget") {
      // 特殊处理，用JSStatelessWidget包裹一层
      newJSWidget = new JSStatelessWidget("FakeStatelessWidget");
      newJSWidget.build = function (context) {
        return jsWidget;
      };
    } else {
      newJSWidget = jsWidget;
    }

    //设置push jsWidget的widget
    newJSWidget.navPushingWidget = this.widget;
    newJSWidget.buildContext = JSBuildContext.inheritBuildContext(newJSWidget, this.widget.buildContext);
    newJSWidget.navPushingWidgetID = this.widget.widgetID;
    this.widget.navPushedWidgets?.set(newJSWidget.widgetID,newJSWidget);
    let widgetData = JSWidgetHelper.buildWidgetData(newJSWidget);

    return widgetData;
  }

  findTopRootWidget():JSBaseWidget | undefined {
    let rootWidget = this.widget.parentWidget;
    if (rootWidget == null || rootWidget == undefined) {
      return this.widget;
    }
    return rootWidget.helper?.findTopRootWidget();
  }
}


//****** TODO Widget树 ******
export class JSWidgetTree {
  buildWidgetDataSeq:string = "";
  childrenWidget:Map<string,JSBaseWidget>;
  callbackID2fun?:Map<string,any>;
  widgetTreeObjMap?:any;
  ownerWidget?:JSBaseWidget;

  constructor(){
    this.buildWidgetDataSeq="";
    this.childrenWidget = new Map();
  }

  static new(buildWidgetDataSeq:string){
    var v = new JSWidgetTree();
    v.buildWidgetDataSeq=buildWidgetDataSeq;
    v.childrenWidget = new Map();
    v.callbackID2fun =new Map();
    v.widgetTreeObjMap = null;
    v.ownerWidget = undefined;
    return v;
  }

  //统一用全局的id生成器
  generateID() {
    return JSCallbackMgr.getInstance().generateID();
  }

  createCallbackID(callback:any) {
    let callbackID = this.ownerWidget?.widgetID + "/" + this.generateID();
    this.callbackID2fun?.set(callbackID,callback);
    return callbackID;
  }

  invokeCallback(callbackID:string, ...args:any) {
    let callback = this.findCallback(callbackID);
    return callback(...args);
  }

  findCallback(callbackID:string) {
    return this.callbackID2fun?.get(callbackID);
  }
}

//****** TODO Widget Mgr ******
export class JSWidgetMgr {
  //JS侧现生成的JSWidget， widgetID为偶数，从0开始
  widgetIDFeed:number;
  widgetID2WidgetMap:Map<string,any>;
  //单例
  static instance?: JSWidgetMgr;
  constructor() {
    this.widgetIDFeed = 0;
    this.widgetID2WidgetMap = new Map();
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new JSWidgetMgr();
    }

    return this.instance;
  }

  
  generateWidgetID() {
    //JS侧现生成的JSWidget， widgetID为偶数，从0开始 +2
    this.widgetIDFeed = this.widgetIDFeed + 2;
    let wID = this.widgetIDFeed;
    return String(wID);
  }

  registerWidget(widget:any) {
    this.widgetID2WidgetMap.set(widget.widgetID,widget);
  }

  remove(widgetID:string) {
    this.widgetID2WidgetMap.delete(widgetID);
  }

  findWidget(widgetID:string) {
    return this.widgetID2WidgetMap.get(widgetID);
  }
}

//****** TODO 初始化JS数据 ******
export function initJSWidgetData(widget:JSBaseWidget) {
  //继承自JSBaseWidget 自定义控件。

  if (widget.widgetID == null || widget.widgetID == undefined || widget.widgetID == "") {
    widget.widgetID = JSWidgetMgr.getInstance().generateWidgetID();
  }

  widget.helper = new JSWidgetHelper(widget);

  //构建系列号，每build一次加1
  widget.buildWidgetDataSeq = "";

  // The Widget Pages that pushed this Widget ID
  // 把当前widget（this） push 出来的widget ID
  // 序列化到JSON里
  widget.navPushingWidgetID = "";

  //不添加进json的控制变量
  //创建自己的widget，为null自己是root
  widget.parentWidget = undefined;

  // The Widget Pages that pushed this Widget
  // 把当前widget（this） push 出来的widget
  widget.navPushingWidget = undefined;

  //The widget that was pushed by this widget
  //由自己this push的widget page
  widget.navPushedWidgets = new Map();
  //
  widget.buildContext = undefined;
  widget.buildingWidgetTree = undefined;
  widget.currentWidgetTree = undefined;
  widget.preWidgetTree = undefined;
  widget.buildWidgetDataSeqFeed = 0;
  widget.buildSeq2WTreeMap = new Map();

  ///性能分析模式 
  ///打开性能分析模式，widget.enableProfile = true
  ///可以重载onBuildEnd，使用getProfileText获得各个阶段耗时
  widget.enableProfile = false;
  //widget.profileInfo = new Map();
}

//****** TODO JSBaseWidget ******
export class JSBaseWidget extends core.Object {
  name:string;        //控件名
  key?:Key;   
  widgetName?:string; 
  className?:string;  
  widgetID:string;
  helper?:JSWidgetHelper;
  navPushingWidgetID?:string;
  buildWidgetDataSeq?:string;
  buildWidgetDataSeqFeed:number;
  parentWidget?:JSBaseWidget;
  state?:any;
  navPushingWidget?:JSBaseWidget;
  navPushedWidgets?:Map<string,JSBaseWidget>;
  buildSeq2WTreeMap?:Map<string,JSWidgetTree>;
  currentWidgetTree?:JSWidgetTree;    //当前树
  buildingWidgetTree?:JSWidgetTree;   //UI树
  preWidgetTree?:JSWidgetTree;        //预处理树
  buildContext?:JSBuildContext;       //BuildContext

  //打开性能分析模式，widget.enableProfile = true
  enableProfile:boolean = false;
  profileInfo:Map<string,any>;
  constructor(name:string,key?:Key) {
    super();
    this.name = name;
    this.key = key;
    this.profileInfo = new Map<string,any>();
    this.widgetID = "";
    this.buildWidgetDataSeqFeed=0;
    initJSWidgetData(this);
  }

  //获取 Widget 关键信息
  getWidgetInfo() {
    let log = "WidgetInfo: Name: " + this.widgetName + " Class: " + this.className + " WID: " + this.widgetID + " buildseq: " + this.buildWidgetDataSeq +
      " currentTreeSeq: " + this.getWidgetTreeBuildSeq(this.currentWidgetTree) + " buildingseq: " + this.getWidgetTreeBuildSeq(this.buildingWidgetTree) +
      " preTreeSeq: " + this.getWidgetTreeBuildSeq(this.preWidgetTree);
    return log;
  }

  //获取树对应JSON结构
  getWidgetTreeBuildSeq(widgetTree?:JSWidgetTree) {
    if (widgetTree == null) {
      return "0";
    }
    return widgetTree.buildWidgetDataSeq;
  }

  onBuildEnd(args?:any) { }

  ///性能分析模式 
  ///打开性能分析模式，widget.enableProfile = true
  ///可以重载onBuildEnd，使用getProfileText获得各个阶段耗时
  setProfileInfo(profileInfo?:Map<string,any>) {
    if (this.enableProfile == true && profileInfo!=null && profileInfo !=undefined) {
      this.profileInfo.set("startDecodeData",profileInfo.get("startDecodeData"));
      this.profileInfo.set("endDecodeData",profileInfo.get("endDecodeData"));
      this.profileInfo.set("buildEnd",profileInfo.get("buildEnd"));
    }
  }

  //获取性能文本
  getProfileText() {
    let profileInfo = this.profileInfo;
    let startEncodeData = profileInfo.get('startEncodeData');
    let startTransferData = profileInfo.get('startTransferData');
    let startDecodeData = profileInfo.get('startDecodeData');
    let endDecodeData = profileInfo.get('endDecodeData');
    let buildEnd = profileInfo.get('buildEnd');
    let transferDataLen = profileInfo.get('transferDataLen');

    let buildDataCost = startTransferData - startEncodeData;
    let transferCost = startDecodeData - startTransferData;
    let decodeDataCost = endDecodeData - startDecodeData;
    let paintCost = buildEnd - endDecodeData;

    let mxcost = endDecodeData - startEncodeData;
    let flutterBuild = endDecodeData - startEncodeData;

    let profileText = '总耗时: XSFlutterTotal: ' + mxcost + 'ms FlutterBuild: ' + paintCost + 'ms 详情:\n' +
      '[JS]buildJSWidgetTree2Json: ' + buildDataCost + "ms \n" +
      '[JS->Native->Dart]transfer(' + (transferDataLen * 2.0 / 1024.0).toFixed(2) + 'Kb): ' + transferCost + "ms\n" +
      '[Dart]DecodeJson: ' + decodeDataCost + "ms\n" +
      '[Dart]flutterBuild: ' + paintCost + "ms";
    return profileText;
  }
}

//****** TODO JSStatefulWidget ******
export class JSStatefulWidget extends JSBaseWidget {
  
  constructor(name:string,key?:Key) {
    super(name, key);

    this.className = "JSStatefulWidget";
    initJSWidgetData(this);
  }

  //subclass override
  createState(){ }
}

//在JS层，要封装控件，如不需要改变UI内容，使用无状态的JSStatelessWidget
export class JSStatelessWidget extends JSBaseWidget {
  constructor(name:string,key?:Key) {
    super(name, key);

    this.className = "JSStatelessWidget";

    initJSWidgetData(this);
  }

  //subclass override
  build(buildContext?:JSBuildContext) {}
}

export class JSWidgetState {
  widget?:JSBaseWidget;
  constructor(widget?:JSBaseWidget) {
    this.widget = widget;
  }

  get context() {
    return this.widget?.buildContext;
  }

  //subclass override
  initState() {
    JSLog.log("JSWidgetState initState ::" + this.widget?.getWidgetInfo());
  }

  setState(fun?:any) {
    JSLog.log("JSWidgetState setState ::" + this.widget?.getWidgetInfo());
    if (fun) {
      fun();
    }
    //call-> Flutter
    this.widget?.helper?.callFlutterRebuild();
  }

  //subclass override
  build(buildContext?:JSBuildContext) {}

  //subclass overwite
  onBuildEnd(args?:any) { }

  //subclass override
  dispose() { }
}
//#endregion


//#region ******** Enum ********

//#region ------ A ------
//****** Axis ******
export enum Axis {
  horizontal = "horizontal",
  vertical = "vertical",
}

//****** xisDirection ******
export enum AxisDirection {
  left = "left",
  down = "down",
  right = "right",
  up = "up",
}

//****** AnimationStatus ******
export enum AnimationStatus { 
  dismissed = "dismissed",
  forward = "forward",
  reverse = "reverse",
  completed = "completed",
}

//****** AnimationBehavior ******
export enum AnimationBehavior {
  normal = "normal",
  preserve = "preserve",
}
//#endregion

//#region ------ B ------
//****** BlendMode ******
export enum BlendMode {
  clear = "clear",
  src = "src",
  dst = "dst",
  srcOver = "srcOver",
  dstOver = "dstOver",
  srcIn = "srcIn",
  dstIn = "dstIn",
  srcOut = "srcOut",
  dstOut = "dstOut",
  srcATop = "srcATop",
  dstATop = "dstATop",
  xor = "xor",
  plus = "plus",
  modulate = "modulate",
  screen = "screen",
  overlay = "overlay",
  darken = "darken",
  lighten = "lighten",
  colorDodge = "colorDodge",
  colorBurn = "colorBurn",
  hardLight = "hardLight",
  softLight = "softLight",
  difference = "difference",
  exclusion = "exclusion",
  multiply = "multiply",
  hue = "hue",
  saturation = "saturation",
  color = "color",
  luminosity = "luminosity",
}


//****** BoxFit ******
export enum BoxFit {
  fill = "fill",
  contain = "contain",
  cover = "cover",
  fitWidth = "fitWidth",
  fitHeight = "fitHeight",
  none = "none",
  scaleDown= "scaleDown",
}

//****** BannerLocation ******
export enum BannerLocation {
  topStart = "topStart",
  topEnd = "topEnd",
  bottomStart = "bottomStart",
  bottomEnd = "bottomEnd",
}

//****** Brightness ******
export enum Brightness {
  dark = "dark",
  light = "light",
}

//****** BlurStyle ******
export enum BlurStyle {
  normal = "normal",
  solid = "solid",
  outer = "outer",
  inner = "inner",
}

//****** BorderStyle ******
export enum BorderStyle {
  none = "none",
  solid = "solid",
}

//****** BottomNavigationBarType ******
export enum BottomNavigationBarType {
  fixed = "enum",
  shifting = "shifting",
}

//****** BoxShape ******
export enum BoxShape {
  circle = "circle",
  rectangle = "rectangle",
}

//****** ButtonTextTheme ******
export enum ButtonTextTheme {
  normal = "normal",
  accent = "accent",
  primary = "primary",
}

//****** ButtonBarLayoutBehavior ******
export enum ButtonBarLayoutBehavior {
  constrained = "constrained",
  padded = "padded",
}

//****** BoxHeightStyle ******
export enum BoxHeightStyle {
  tight = "tight",
  max = "max",
  includeLineSpacingMiddle = "includeLineSpacingMiddle",
  includeLineSpacingTop = "includeLineSpacingTop",
  includeLineSpacingBottom = "includeLineSpacingBottom",
  strut = "strut",
}

//#endregion

//#region ------ C ------
//****** CrossAxisAlignment ******
export enum CrossAxisAlignment {
  start = "start",
  end = "end",
  center = "center",
  stretch = "stretch",
  baseline = "baseline",
}

//****** Curves ******
export enum Curve {
  linear = "linear",
  decelerate = "decelerate",
  ease = "ease",
  easeIn = "easeIn",
  easeOut = "easeOut",
  easeInOut = "easeInOut",
  fastOutSlowIn = "fastOutSlowIn",
  bounceIn = "bounceIn",
  bounceOut = "bounceOut",
  bounceInOut = "bounceInOut",
  elasticIn = "elasticIn",
  elasticOut = "elasticOut",
  elasticInOut = "elasticInOut",
}

//****** Clip ******
export enum Clip {
  none = "none",
  hardEdge = "hardEdge",
  antiAlias = "antiAlias",
  antiAliasWithSaveLayer = "antiAliasWithSaveLayer",
}

//****** CollapseMode ******
export enum CollapseMode {
  parallax = "parallax",
  pin = "pin",
  none = "none",
}

//****** CrossFadeState ******
export enum CrossFadeState {
  showFirst = "showFirst",
  showSecond = "showSecond",
}
//#endregion

//#region ------ D ------
//****** DragStartBehavior ******
export enum DragStartBehavior {
  down = "down",
  start = "start",
}

//****** DecorationPosition ******
export enum DecorationPosition  {
  background = "background",
  foreground = "foreground",
}
//#endregion

//#region ------ F ------
//****** FlutterLogoStyle ******
export enum FlutterLogoStyle {
  horizontal = "horizontal",
  markOnly = "markOnly",
  stacked = "stacked",
}

//****** FloatingLabelBehavior ******
export enum FloatingLabelBehavior {
  never = "never",
  auto = "auto",
  always = "always",
}

//****** FontWeight ******
export enum FontWeight {
  bold = "bold",
  normal = "normal",
  w100 = "w100",
  w200 = "w200",
  w300 = "w300",
  w400 = "w400",
  w500 = "w500",
  w600 = "w600",
  w700 = "w700",
  w800 = "w800",
  w900 = "w900",
}

//****** FlexFit ******
export enum FlexFit {
  tight = "tight",
  loose = "loose",
}

//****** FontStyle ******
export enum FontStyle {
  italic = "italic",
  normal = "normal",
}

//****** FilterQuality ******
export enum FilterQuality {
  none = "none",
  low = "low",
  medium = "medium",
  high = "high",
}

//****** FloatingActionButtonLocation ******
export enum FloatingActionButtonLocation  {
  endDocked = "endDocked",
  centerDocked = "centerDocked",
  endFloat = "endFloat",
  centerFloat = "centerFloat",
  startTop = "startTop",
  miniStartTop = "miniStartTop",
  endTop = "endTop",
}
//#endregion

//#region ------ H ------
//****** HitTestBehavior ******
export enum HitTestBehavior {
  deferToChild = "deferToChild",
  opaque = "opaque",
  translucent = "translucent",
}
//#endregion

//#region ------ I ------
//****** ImageRepeat ******
export enum ImageRepeat {
  repeat = "repeat",
  repeatX = "repeatX",
  repeatY = "repeatY",
  noRepeat = "noRepeat",
}
//#endregion

//#region ------ L ------
//****** ListTileStyle ******
export enum ListTileStyle {
  list = "list",
  drawer = "drawer",
}

//****** ListTileControlAffinity ******
export enum ListTileControlAffinity {
  leading = "leading",
  trailing = "trailing",
  platform = "platform",
}

//#endregion

//#region ------ M ------
//****** MainAxisAlignment ******
export enum MainAxisAlignment {
  start = "start",
  end = "end",
  center = "center",
  spaceBetween = "spaceBetween",
  spaceAround = "spaceAround",
  spaceEvenly = "spaceEvenly",
}

//****** MainAxisSize ******
export enum MainAxisSize {
  min = "min",
  max = "max",
}

//****** MaterialTapTargetSize ******
export enum MaterialTapTargetSize {
  padded = "padded",
  shrinkWrap = "shrinkWrap",
}

//****** MaterialTapTargetSize ******
export enum MaterialType {
  circle = "circle",
  button = "button",
  canvas = "canvas",
  card = "card",
  transparency = "transparency",
}
//#endregion

//#region ------ N ------
//****** NavigationMode ******
export enum NavigationMode {
  traditional = "traditional",
  directional = "directional",
}
//#endregion

//#region ------ O ------
//****** Overflow ******
export enum Overflow {
  visible = "visible",
  clip = "clip",
}
//#endregion

//#region ------ P ------
//****** PaintingStyle ******
export enum PaintingStyle {
  fill = "fill",
  stroke = "stroke",
}

//****** PlaceholderAlignment ******
export enum PlaceholderAlignment {
  baseline = "baseline",
  aboveBaseline = "aboveBaseline",
  belowBaseline = "belowBaseline",
  top = "top",
  bottom = "bottom",
  middle = "middle",
}

//#endregion

//#region ------ R ------
//****** RenderComparison ******
export enum RenderComparison {
  identical = "identical",
  metadata = "metadata",
  paint = "paint",
  layout = "layout",
}

//#endregion

//#region ------ S ------
//****** StackFit ******
export enum StackFit {
  loose = "loose",
  expand = "expand",
  passthrough = "passthrough",
}

//****** StrokeCap ******
export enum StrokeCap {
  butt = "butt",
  round = "round",
  square = "square",
}

//****** StrokeJoin ******
export enum StrokeJoin {
  miter = "miter",
  round = "round",
  bevel = "bevel",
}

//****** StretchMode ******
export enum StretchMode {
  zoomBackground = "zoomBackground",
  blurBackground = "blurBackground",
  fadeTitle = "fadeTitle",
}

//****** SnackBarClosedReason ******
export enum SnackBarClosedReason {
  action = "action",
  dismiss = "dismiss",
  swipe = "swipe",
  hide = "hide",
  remove = "remove",
  timeout = "timeout",
}

//****** ScrollPositionAlignmentPolicy ******
export enum ScrollPositionAlignmentPolicy {
  explicit = "explicit",
  keepVisibleAtEnd = "keepVisibleAtEnd",
  keepVisibleAtStart = "keepVisibleAtStart",
}

//#endregion

//#region ------ T ------
//****** TileMode ******
export enum TileMode {
  clamp = "clamp",
  repeated = "repeated",
  mirror = "mirror",
}

//****** TextWidthBasis ******
export enum TextWidthBasis {
  parent = "parent",
  longestLine = "longestLine",
}

//****** TextAlign ******
export enum TextAlign {
  left = "left",
  right = "right",
  center = "center",
  justify = "justify",
  start = "start",
  end = "end",
}

//****** TextDirection ******
export enum TextDirection {
  rtl = "rtl",
  ltr = "ltr",
}

//****** TextDecorationStyle ******
export enum TextDecorationStyle {
  ashed = "ashed",
  dotted = "dotted",
  double = "double",
  solid = "solid",
}

//****** TextBaseline ******
export enum TextBaseline {
  alphabetic = "alphabetic",
  ideographic = "ideographic",
}

//****** TextDecoration ******
export enum TextDecoration {
  none = "none",
  underline = "underline",
  overline = "overline",
  lineThrough = "lineThrough",
}

//****** TextOverflow ******
export enum TextOverflow {
  clip = "clip",
  fade = "fade",
  ellipsis = "ellipsis",
}

//****** TextCapitalization ******
export enum TextCapitalization {
  words = "words",
  sentences = "sentences",
  characters = "characters",
  none = "none",
}

//****** TextInputAction ******
export enum TextInputAction {
  none = "none",
  nspecified = "nspecified",
  one = "one",
  go = "go",
  search = "search",
  send = "send",
  next = "next",
  previous = "previous",
  continueAction = "continueAction",
  join = "join",
  route = "route",
  emergencyCall = "emergencyCall",
  newline = "newline",
}

//****** TableCellVerticalAlignment ******
export enum TableCellVerticalAlignment {
  top = "top",
  middle = "middle",
  bottom = "bottom",
  baseline = "baseline",
  fill = "fill",
}

//****** TabBarIndicatorSize ******
export enum TabBarIndicatorSize {
  tab = "tab",
  label = "label",
}

//****** TargetPlatform ******
export enum TargetPlatform {
  android = "android",
  fuchsia = "fuchsia",
  iOS = "iOS",
  linux = "linux",
  macOS = "macOS",
  windows = "windows",
}
//#endregion

//#region ------ V ------
//****** VerticalDirection ******
export enum VerticalDirection {
  up = "up",
  down = "down",
}
//#endregion

//#region ------ W ------
//****** WrapAlignment ******
export enum WrapAlignment {
  start = "start",
  end = "end",
  center = "center",
  spaceBetween = "spaceBetween",
  spaceAround = "spaceAround",
  spaceEvenly = "spaceEvenly",
}

//****** WrapCrossAlignment ******
export enum WrapCrossAlignment {
  start = "start",
  end = "end",
  center = "center",
}
//#endregion 

//#endregion


//#region ******** Class ********

//#region ------- A -------
//****** Alignment ******
export class Alignment extends DartClass {
  x?:number;
  y?:number;
  
  static new(x:number, y:number){
    var v = new Alignment();
    v.x=x;
    v.y=y;
    return v;
  }

  static topLeft = Alignment.new(-1.0, -1.0); 
  static topCenter = Alignment.new(0.0, -1.0); 
  static topRight = Alignment.new(1.0, -1.0); 
  static centerLeft = Alignment.new(-1.0, 0.0); 
  static center = Alignment.new(0.0, 0.0); 
  static centerRight = Alignment.new(1.0, 0.0);
  static bottomLeft = Alignment.new(-1.0, 1.0);
  static bottomCenter = Alignment.new(0.0, 1.0);
  static bottomRight = Alignment.new(1.0, 1.0); 
} 

//****** AlignmentDirectional ******
export class AlignmentDirectional extends DartClass {
  start?:number;
  y?:number;

  static new(start:number, y:number){
    var v = new AlignmentDirectional();
    v.start=start;
    v.y=y;
    return v;
  }
}

//****** AlwaysScrollableScrollPhysics ******
export class AlwaysScrollableScrollPhysics extends DartClass {
  parent?:AlwaysScrollableScrollPhysics;

  static new(parent?:AlwaysScrollableScrollPhysics):{} {
    var v = new AlwaysScrollableScrollPhysics();
    v.parent=parent;
    return v;
  }
}

//****** AssetBundle ******
export class AssetBundle extends DartClass {
  baseUrl?:Uri;

  static network(baseUrl:Uri) {
    var v = new AssetBundle();
    v.constructorName = "network";
    v.baseUrl = baseUrl;
    return v;
  }

  static platform() {
    var v = new AssetBundle();
    v.constructorName = "platform";
    return v;
  }
}

//****** AssetImage ******
interface AssetImageConfig {
  bundle?:AssetBundle;
  packageName?:string;
}
export class AssetImage extends DartClass {
  assetName?:string;
  bundle?:AssetBundle;
  packageName?:string;

  /**
   * @param config config: 
    {
      assetName:string, 
      bundle?:BaseAssetBundle, 
      packageName?:string
    }
   */
  static new(assetName:string,config?: AssetImageConfig) {
    var v = new AssetImage();
    v.assetName = assetName
    if(config!=null && config!=undefined){
      v.bundle = config.bundle;
      v.packageName = config.packageName;
    }
    return v;
  }
}
//#endregion

//#region ------- B ------- 
//****** BoxConstraints ******
interface BoxConstraintsConfig {
  minWidth?:number;
  maxWidth?:number;
  minHeight?:number;
  maxHeight?:number;
}
export class BoxConstraints extends DartClass {
  minWidth?:number;
  maxWidth?:number;
  minHeight?:number;
  maxHeight?:number;

  /**
   * @param config config: 
    {
      minWidth?:number, 
      maxWidth?:number, 
      minHeight?:number, 
      maxHeight?:number
    }
   */
  static new(config?: BoxConstraintsConfig){
    var v =new BoxConstraints();
    if(config!=null && config!=undefined){
      v.minWidth = config.minWidth;
      v.maxWidth = config.maxWidth;
      v.minHeight = config.minHeight;
      v.maxHeight = config.maxHeight;
    }
    return v;
  }
}

//****** BorderSide ******
interface BorderSideConfig {
  color?:Color;
  width?:number;
  style?:BorderStyle;
}
export class BorderSide extends DartClass {
  color?:Color;
  width?:number;
  style?:BorderStyle;

  /**
   * @param config config: 
      {
        color?:Color, 
        width?:number, 
        style?:BorderStyle
      }
   */
  static new(config?: BorderSideConfig){
    var v =new BorderSide();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.width = config.width;
      v.style = config.style;
    }
    return v;
  }

  static none() {
    let v = new BorderSide();
    v.constructorName = "none";
    return v;
  }
}

//****** BorderRadius ******
interface BorderRadiusConfig {
  top?:Radius;
  bottom?:Radius;
  left?:Radius;
  right?:Radius;
  topLeft?:Radius;
  topRight?:Radius;
  bottomLeft?:Radius;
  bottomRight?:Radius;
}
export class BorderRadius  extends DartClass {
  radius?:number|Radius;
  top?:Radius;
  bottom?:Radius;
  left?:Radius;
  right?:Radius;
  topLeft?:Radius;
  topRight?:Radius;
  bottomLeft?:Radius;
  bottomRight?:Radius;

  static zero(){
    let o = new BorderRadius();
    o.constructorName = "zero";
    return o;
  }

  static all(radius:Radius){
    let v = new BorderRadius();
    v.constructorName = "all";
    v.radius = radius;
    return v;
  }

  static circular(radius:number){
    let v = new BorderRadius();
    v.constructorName = "circular";
    v.radius = radius;
    return v;
  }

  /**
   * @param config config: 
      {
        top?:Radius, 
        bottom?:Radius
      }
   */
  static vertical(config?: BorderRadiusConfig){
    let v = new BorderRadius();
    v.constructorName = "vertical";
    if(config!=null && config!=undefined){
      v.top = config.top;
      v.bottom = config.bottom;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        left?:Radius, 
        right?:Radius
      }
   */
  static horizontal(config?: BorderRadiusConfig){
    let v = new BorderRadius();
    v.constructorName = "horizontal";
    if(config!=null && config!=undefined){
      v.left = config.left;
      v.right = config.right;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        topLeft?:Radius, 
        topRight?:Radius, 
        bottomLeft?:Radius, 
        bottomRight?:Radius,
      }
   */
  static only(config?: BorderRadiusConfig){
    let v = new BorderRadius();
    v.constructorName = "only";
    if(config!=null && config!=undefined){
      v.topLeft = config.topLeft;
      v.topRight = config.topRight;
      v.bottomLeft = config.bottomLeft;
      v.bottomRight = config.bottomRight;
    }
    return v;
  }
}

//****** BorderRadiusDirectional ******
interface BorderRadiusDirectionalConfig {
  top?:Radius;
  bottom?:Radius;
  start?:Radius;
  end?:Radius;

  topStart?:Radius;
  topEnd?:Radius;
  bottomStart?:Radius;
  bottomEnd?:Radius;
}
export class BorderRadiusDirectional  extends DartClass {
  radius?:Radius| number;
  top?:Radius;
  bottom?:Radius;

  start?:Radius;
  end?:Radius;

  topStart?:Radius;
  topEnd?:Radius;
  bottomStart?:Radius;
  bottomEnd?:Radius;

  static zero(){
    let o = new BorderRadiusDirectional();
    o.constructorName = "zero";
    return o;
  }

  static all(radius:Radius){
    let v = new BorderRadiusDirectional();
    v.constructorName = "all";
    v.radius = radius;
    return v;
  }

  static circular(radius:number){
    let v = new BorderRadiusDirectional();
    v.constructorName = "circular";
    v.radius = radius;
    return v;
  }

  /**
   * @param config config: 
      {
        top?:Radius, 
        bottom?:Radius
      }
   */
  static vertical(config?: BorderRadiusDirectionalConfig){
    let v = new BorderRadiusDirectional();
    v.constructorName = "vertical";
    if(config!=null && config!=undefined){
      v.top = config.top;
      v.bottom = config.bottom;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        start?:Radius, 
        end?:Radius
      }
   */
  static horizontal(config?: BorderRadiusDirectionalConfig){
    let v = new BorderRadiusDirectional();
    v.constructorName = "horizontal";
    if(config!=null && config!=undefined){
      v.start = config.start;
      v.end = config.end;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        topStart?:Radius, 
        topEnd?:Radius, 
        bottomLeft?:Radius, 
        bottomRight?:Radius,
      }
   */
  static only(config?: BorderRadiusDirectionalConfig){
    let v = new BorderRadiusDirectional();
    v.constructorName = "only";
    if(config!=null && config!=undefined){
      v.topStart = config.topStart;
      v.topEnd = config.topEnd;
      v.bottomStart = config.bottomStart;
      v.bottomEnd = config.bottomEnd;
    }
    return v;
  }
}


//****** Border ******
interface BorderConfig {
  top?:BorderSide;
  right?:BorderSide;
  bottom?:BorderSide;
  left?:BorderSide;
  vertical?:BorderSide;
  horizontal?:BorderSide;

  color?:Color;
  width?:number;
  style?:BorderStyle;
}
export class Border extends DartClass {
  top?:BorderSide;
  right?:BorderSide;
  bottom?:BorderSide;
  left?:BorderSide;
  vertical?:BorderSide;
  horizontal?:BorderSide;

  color?:Color;
  width?:number;
  style?:BorderStyle;

  /**
   * @param config config: 
    {
      top?:BorderSide, 
      right?:BorderSide, 
      bottom?:BorderSide, 
      left?:BorderSide,
    }
   */
  static new(config?: BorderConfig)  {
    var v = new Border();
    if(config!=null && config!=undefined){
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.left = config.left;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        color?:Color, 
        width?:number, 
        style?:BorderStyle,
      }
   */
  static all(config: BorderConfig) {
    var v = new Border();  
    v.constructorName = "all";
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.width = config.width;
      v.style = config.style;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        vertical?:BorderSide, 
        horizontal?:BorderSide
      }
   */
  static symmetric(config?: BorderConfig) {
    var v = new Border();
    v.constructorName = "symmetric";
    if(config!=null && config!=undefined){
      v.vertical = config.vertical;
      v.horizontal = config.horizontal;
    }
    return v;
  }
}


//****** BorderDirectional ******
interface BorderDirectionalConfig {
  top?:BorderSide;
  start?:BorderSide;
  bottom?:BorderSide;
  end?:BorderSide;
}
export class BorderDirectional extends DartClass {
  top?:BorderSide;
  start?:BorderSide;
  bottom?:BorderSide;
  end?:BorderSide;

  /**
   * @param config config: 
      {
        top?:BorderSide, 
        start?:BorderSide,
        bottom?:BorderSide,
        end?:BorderSide,
      }
   */
  static new(config?: BorderDirectionalConfig) {
    var v = new BorderDirectional();
    if(config!=null && config!=undefined){
      v.top = config.top;
      v.start = config.start;
      v.end = config.end;
      v.bottom = config.bottom;
    }
    return v;
  }
}

//****** ButtonThemeData ******
interface ButtonThemeDataConfig { //定义了两个可选属性
  textTheme?:ButtonTextTheme;
  minWidth?:number;
  height?:number;
  padding?:EdgeInsets;
  layoutBehavior?:ButtonBarLayoutBehavior;
  alignedDropdown?:boolean;
  buttonColor?:Color;
  disabledColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorScheme?:ColorScheme;
}
export class ButtonThemeData extends DartClass {
  textTheme?:ButtonTextTheme;
  minWidth?:number;
  height?:number;
  padding?:EdgeInsets;
  layoutBehavior?:ButtonBarLayoutBehavior;
  alignedDropdown?:boolean;
  buttonColor?:Color;
  disabledColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorScheme?:ColorScheme;

  /**
   * @param config config: 
      {
        textTheme?:ButtonTextTheme, 
        minWidth?:number, 
        height?:number, 
        padding?:EdgeInsets, 
        layoutBehavior?:ButtonBarLayoutBehavior, 
        alignedDropdown?:boolean, 
        buttonColor?:Color, 
        disabledColor?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        colorScheme?:ColorScheme, 
      }
   */
  static new(config?: ButtonThemeDataConfig) {
      var v= new ButtonThemeData();
      if(config!=null && config!=undefined){
        v.textTheme = config.textTheme;
        v.minWidth = config.minWidth;
        v.height = config.height;
        v.padding = config.padding;
        v.layoutBehavior = config.layoutBehavior;
        v.alignedDropdown = config.alignedDropdown;
        v.buttonColor = config.buttonColor;
        v.disabledColor = config.disabledColor;
        v.focusColor = config.focusColor;
        v.hoverColor = config.hoverColor;
        v.highlightColor = config.highlightColor;
        v.splashColor = config.splashColor;
        v.colorScheme = config.colorScheme;
      }
      return v;
  }
}

//****** BoxDecoration ******
interface BoxDecorationConfig { 
  color?:Color;
  border?:Border;
  borderRadius?:BorderRadius;
  boxShadow?:BoxShadow;
  gradient?:Gradient;
  backgroundBlendMode?:BlendMode;
  shape?:BoxShape;
  image?:DecorationImage;
}
export class BoxDecoration extends DartClass {
  color?:Color;
  border?:Border;
  borderRadius?:BorderRadius;
  boxShadow?:BoxShadow;
  gradient?:Gradient;
  backgroundBlendMode?:BlendMode;
  shape?:BoxShape;
  image?:DecorationImage;

  /**
   * @param config config: 
      {
        color?:Color, 
        border?:Border;
        borderRadius?:BorderRadius, 
        boxShadow?:BoxShadow, 
        gradient?:BaseGradient 
        backgroundBlendMode?:BlendMode, 
        shape?:BoxShape,
        image?:DecorationImage, 
      }
    */
  static new(config?: BoxDecorationConfig){
    var v = new BoxDecoration();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.border = config.border;
      v.borderRadius = config.borderRadius;
      v.boxShadow = config.boxShadow;
      v.gradient = config.gradient;
      v.backgroundBlendMode = config.backgroundBlendMode;
      v.shape = config.shape;
      v.image = config.image;
    }
    return v;
  }
}

//****** BannerPainter ******
interface BannerPainterConfig {
  message:string;
  textDirection:TextDirection;
  location:BannerLocation;
  layoutDirection?:TextDirection;
  color?:Color;
  textStyle?:TextStyle;
}
export class BannerPainter extends DartClass {
  message?:string;
  textDirection?:TextDirection;
  location?:BannerLocation;
  layoutDirection?:TextDirection;
  color?:Color;
  textStyle?:TextStyle;

  /**
   * @param config config: 
      {
        message?:string, 
        textDirection?:TextDirection, 
        location?:BannerLocation, 
        layoutDirection?:TextDirection, 
        color?:Color, 
        textStyle?:TextStyle, 
      }
    */
  static new(config: BannerPainterConfig){
    var v = new BannerPainter();
    if(config!=null && config!=undefined){
      v.message = config.message;
      v.textDirection = config.textDirection;
      v.location = config.location;
      v.layoutDirection = config.layoutDirection;
      v.color = config.color;
      v.textStyle = config.textStyle;
    }
    return v;
  }
}

//****** BoxShadow ******
interface BoxShadowConfig {
  color?:Color;
  offset?:Offset;
  blurRadius?:number;
  spreadRadius?:number;
}
export class BoxShadow extends DartClass {
  color?:Color;
  offset?:Offset;
  blurRadius?:number;
  spreadRadius?:number;

  /**
   * @param config config: 
    {
      color?:Color, 
      offset?:Offset, 
      blurRadius?:number, 
      spreadRadius?:number
    }
   */
  static new(config?: BoxShadowConfig) {
    var v = new BoxShadow();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.offset = config.offset;
      v.blurRadius = config.blurRadius;
      v.spreadRadius = config.spreadRadius;
    }
    return v;
  }
}

//****** BouncingScrollPhysics ******
export class BouncingScrollPhysics extends DartClass {
  parent?:ScrollPhysics;
  static new(config?: ScrollPhysicsConfig) {
    var v = new BouncingScrollPhysics();
    if(config!=null && config!=undefined){
      v.parent = config.parent;
    }
    return v;
  }
}
//#endregion

//#region ------- C -------
//****** Color ******
export class Color extends DartClass {
  value?: number;
  a?: number;
  r?: number;
  g?: number;
  b?: number;
  opacity?: number;

  static new(value: number)  {
    let v = new Color();
    v.value = value;
    return v;
  }

  static fromARGB(a: number, r: number, g: number, b: number) {
    let v = new Color();
    v.constructorName = "fromARGB";
    v.a = a;
    v.r = r;
    v.g = g;
    v.b = b;
    return v;
  }

  static fromRGBO(r: number, g: number, b: number, opacity: number)  {
    let v = new Color();
    v.constructorName = "fromRGBO";
    v.opacity = opacity;
    v.r = r;
    v.g = g;
    v.b = b;
    return v;
  }
}

//****** Color ******
export class Colors extends Color{
  static transparent = Color.new(0x00000000);
  static black = Color.new(0xff000000);
  static black87 = Color.new(0xdd000000);
  static black54 = Color.new(0x8a000000);
  static black45 = Color.new(0x73000000);
  static black38 = Color.new(0x61000000);
  static black26 = Color.new(0x42000000);
  static black12 = Color.new(0x1f000000);
  static white = Color.new(0xffffffff);
  static white70 = Color.new(0xb3ffffff);
  static white54 = Color.new(0x8affffff);
  static white30 = Color.new(0x4dffffff);
  static white24 = Color.new(0x3dffffff);
  static white12 = Color.new(0x1fffffff);
  static white10 = Color.new(0x1affffff);
  static red = Color.new(0xFFF44336);
  static redAccent = Color.new(0xFFFF5252);
  static pink = Color.new(0xFFE91E63);
  static pinkAccent = Color.new(0xFFFF4081);
  static purple = Color.new(0xFF9C27B0);
  static purpleAccent = Color.new(0xFFE040FB);
  static deepPurple = Color.new(0xFF673AB7);
  static deepPurpleAccent = Color.new(0xFF7C4DFF);
  static indigo = Color.new(0xFF3F51B5);
  static indigoAccent = Color.new(0xFF536DFE);
  static blue = Color.new(0xFF2196F3);
  static blueAccent = Color.new(0xFF448AFF);
  static lightBlue = Color.new(0xFF03A9F4);
  static lightBlueAccent = Color.new(0xFF40C4FF);
  static cyan = Color.new(0xFF00BCD4);
  static cyanAccent = Color.new(0xFF18FFFF);
  static teal = Color.new(0xff009688);
  static tealAccent = Color.new(0xFF64FFDA);
  static green = Color.new(0xFF4CAF50);
  static greenAccent = Color.new(0xFF69F0AE);
  static lightGreen = Color.new(0xFF8BC34A);
  static lightGreenAccent = Color.new(0xFFB2FF59);
  static lime = Color.new(0xFFCDDC39);
  static limeAccent = Color.new(0xFFEEFF41);
  static yellow = Color.new(0xFFFFEB3B);
  static yellowAccent = Color.new(0xFFFFFF00);
  static amber = Color.new(0xFFFFC107);
  static amberAccent = Color.new(0xFFFFD740);
  static orange = Color.new(0xFFFF9800);
  static orangeAccent = Color.new(0xFFFFAB40);
  static deepOrange = Color.new(0xFFFF5722);
  static deepOrangeAccent = Color.new(0xFFFF6E40);
  static brown = Color.new(0xFF795548);
  static grey = Color.new(0xFF9E9E9E);
  static blueGrey = Color.new(0xFF607D8B);
}

//****** ColorFilter ******
export class ColorFilter extends DartClass {
  color?:Color;
  blendMode?:BlendMode;

  static new(color:Color, blendMode:BlendMode) {
    let v = new ColorFilter();
    v.color = color;
    v.blendMode = blendMode;
    return v;
  }

  static mode(color:Color, blendMode:BlendMode){
    let v = new ColorFilter();
    v.constructorName = "mode";
    v.color = color;
    v.blendMode = blendMode;
    return v;
  }
}

//****** TODO ColorScheme ******
interface ColorSchemeConfig {
  primary?:Color;
  primaryVariant?:Color;
  secondary?:Color;
  secondaryVariant?:Color;
  surface?:Color;
  background?:Color;
  error?:Color;
  onPrimary?:Color;
  onSecondary?:Color;
  onSurface?:Color;
  onBackground?:Color;
  onError?:Color;
  brightness?:Brightness;
  primarySwatch?:Color;
  accentColor?:Color;
  cardColor?:Color;
  backgroundColor?:Color;
  errorColor?:Color;
}
export class ColorScheme extends DartClass {
  primary?:Color;
  primaryVariant?:Color;
  secondary?:Color;
  secondaryVariant?:Color;
  surface?:Color;
  background?:Color;
  error?:Color;
  onPrimary?:Color;
  onSecondary?:Color;
  onSurface?:Color;
  onBackground?:Color;
  onError?:Color;
  brightness?:Brightness;
  primarySwatch?:Color;
  accentColor?:Color;
  cardColor?:Color;
  backgroundColor?:Color;
  errorColor?:Color;

  /**
   * @param config config: 
      {
        primary?:Color, 
        primaryVariant?:Color, 
        secondary?:Color, 
        secondaryVariant?:Color, 
        surface?:Color, 
        background?:Color, 
        error?:Color,
        onPrimary?:Color, 
        onSecondary?:Color, 
        onSurface?:Color, 
        onBackground?:Color, 
        onError?:Color, 
        brightness?:Brightness
      }
   */
  static new(config?: ColorSchemeConfig) {
    var v = new ColorScheme(); 
    if(config!=null && config!=undefined){
      v.primary = config.primary;
      v.primaryVariant = config.primaryVariant;
      v.secondary = config.secondary;
      v.secondaryVariant = config.secondaryVariant;
      v.surface = config.surface;
      v.background = config.background;
      v.error = config.error;
      v.onPrimary = config.onPrimary;
      v.onSecondary = config.onSecondary;
      v.onSurface = config.onSurface;
      v.onBackground = config.onBackground;
      v.onError = config.onError;
      v.brightness = config.brightness;
    }
    return v;
  }
  
  static fromSwatch(primarySwatch?:Color,accentColor?:Color,cardColor?:Color,backgroundColor?:Color, errorColor?:Color,brightness?:Brightness) {
    let v = new ColorScheme();
    v.constructorName = "fromSwatch";

    v.primarySwatch = primarySwatch;
    v.accentColor = accentColor;
    v.cardColor = cardColor;
    v.backgroundColor = backgroundColor;
    v.errorColor = errorColor;
    v.brightness = brightness;
    return v;
  }
}

//****** CircularNotchedRectangle ******
export class CircularNotchedRectangle extends DartClass {
  static new() {
    return new CircularNotchedRectangle();
  }
}

//****** ClampingScrollPhysics ******
export class ClampingScrollPhysics extends DartClass {
  parent?:ClampingScrollPhysics;
  static new(parent?:ClampingScrollPhysics) {
    var v = new ClampingScrollPhysics();
    v.parent = parent;
    return v;
  }
}


//****** CurveTween ******
export class CurveTween extends FlutterWidget {
  curve?:Curve;
  static new(curve?:Curve) {
    var v = new CurveTween();
    v.curve = curve;
    return v;
  };
}

//#endregion

//#region ------- D -------
//****** Duration ******
interface DurationConfig {
  days?:number;
  hours?:number;
  minutes?:number;
  seconds?:number;
  milliseconds?:number;
}
export class Duration extends DartClass {
  days?:number;
  hours?:number;
  minutes?:number;
  seconds?:number;
  milliseconds?:number;

  /**
   * @param config config: 
      {
        days?:number, 
        hours?:number, 
        minutes?:number, 
        seconds?:number, 
        milliseconds?:number
      }
   */
  static new(config?: DurationConfig) {
    var v = new Duration();
    if(config!=null && config!=undefined){
      v.days = config.days;
      v.hours = config.hours;
      v.minutes = config.minutes;
      v.seconds = config.seconds;
      v.milliseconds = config.milliseconds;
    }
    return v;
  }
}
//#endregion

//#region ------- E -------
//****** EdgeInsets ******
interface EdgeInsetsConfig {
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  value?:number;
  vertical?:number;
  horizontal?:number;
}
export class EdgeInsets extends DartClass {
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  value?:number;
  vertical?:number;
  horizontal?:number;

  /**
   * @param config config:
      {
        left?:number,
        top?:number,
        right?:number,
        bottom?:number
      }
   */
  static new(config?: EdgeInsetsConfig) {
    var v = new EdgeInsets();
    if(config!=null && config!=undefined){
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
    }
    return v;
  }

  static zero() {
    let v = new EdgeInsets();
    v.constructorName = "zero";
    return v;
  }

  static fromLTRB(left:number, top:number, right:number, bottom:number) {
    let v = new EdgeInsets();
    v.constructorName = "fromLTRB";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;
    return v;
  }

  /**
   * @param config config: 
      {
        left?:number, 
        top?:number, 
        right?:number, 
        bottom?:number
      }
   */
  static only(config?: EdgeInsetsConfig) {
    let v = new EdgeInsets();
    v.constructorName = "only";
    if(config!=null && config!=undefined){
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
    }
    return v;
  }

  static all(value:number){
    let v = new EdgeInsets();
    v.constructorName = "all";
    v.value = value;
    return v;
  }

  /**
   * @param config config: 
      {
        vertical?:number, 
        horizontal?:number
      }
   */
  static symmetric(config?: EdgeInsetsConfig) {
    let v = new EdgeInsets();
    v.constructorName = "symmetric";
    if(config!=null && config!=undefined){
      v.vertical = config.vertical;
      v.horizontal = config.horizontal;
    }
    return v;
  }
}

//****** EdgeInsetsDirectional ******
interface EdgeInsetsDirectionalConfig {
  start?:number;
  top?:number;
  end?:number;
  bottom?:number;
}
export class EdgeInsetsDirectional extends DartClass {
  start?:number;
  top?:number;
  end?:number;
  bottom?:number;

  /**
   * @param config config: 
      {
        start?:number, 
        top?:number, 
        end?:number, 
        bottom?:number,
      }
   */
  static new(config?: EdgeInsetsDirectionalConfig) {
    var v = new EdgeInsetsDirectional();
    if(config!=null && config!=undefined){
      v.start = config.start;
      v.top = config.top;
      v.end = config.end;
      v.bottom = config.bottom;
    }
    return v;
  }

  static fromSTEB(start:number, top:number, end:number, bottom:number) {
    let v = new EdgeInsetsDirectional();
    v.constructorName = "fromSTEB";
  
    v.start = start;
    v.top = top;
    v.end = end;
    v.bottom = bottom;
    return v;
  }

  /**
   * @param config config: 
      {
        start?:number, 
        top?:number, 
        end?:number, 
        bottom?:number
      }
   */
  static only(config?: EdgeInsetsDirectionalConfig) {
    let v = new EdgeInsetsDirectional();
    v.constructorName = "only";
    if(config!=null && config!=undefined){
      v.start = config.start;
      v.top = config.top;
      v.end = config.end;
      v.bottom = config.bottom;
    }
    return v;
  }
}

//#endregion

//#region ------- F -------
//****** FlexColumnWidth ******
export class FlexColumnWidth extends DartClass {
  value?:number;

  static new(value:number) {
    var v = new FlexColumnWidth();
    v.value = value;
    return v;
  }
}

//****** FlutterLogoDecoration ******
interface FlutterLogoDecorationConfig {
  textColor?:Color;
  style?:FlutterLogoStyle;
  margin?:EdgeInsets;
}
export class FlutterLogoDecoration extends DartClass {
  textColor?:Color;
  style?:FlutterLogoStyle;
  margin?:EdgeInsets;

  /**
   * @param config config: 
      {
        textColor?:Color, 
        style?:FlutterLogoStyle, 
        margin?:EdgeInsets, 
      }
   */
  static new(config?: FlutterLogoDecorationConfig) {
    var v = new FlutterLogoDecoration();
    if(config!=null && config!=undefined){
      v.textColor = config.textColor;
      v.style = config.style;
      v.margin = config.margin;
    }
    return v;
  }
}

//****** FractionalOffset ******
export class FractionalOffset extends DartClass {
  dx?:number;
  dy?:number;

  static new(dx:number, dy:number) {
    var v = new FractionalOffset();
    v.dx = dx;
    v.dy = dy;
    return v;
  }

  static topLeft = FractionalOffset.new(0.0, 0.0); 
  static topCenter = FractionalOffset.new(0.5, 0.0); 
  static topRight = FractionalOffset.new(1.0, 0.0); 

  static centerLeft = FractionalOffset.new(0.0, 0.5); 
  static center = FractionalOffset.new(0.5, 0.5); 
  static centerRight = FractionalOffset.new(1.0, 0.5);

  static bottomLeft = FractionalOffset.new(0.0, 1.0);
  static bottomCenter = FractionalOffset.new(0.5, 1.0);
  static bottomRight = FractionalOffset.new(1.0, 1.0); 

}

//****** FixedColumnWidth ******
export class FixedColumnWidth extends DartClass {
  value?:number;
  static new(value:number) {
    var v = new FixedColumnWidth();
    v.value = value;
    return v;
  }
}

//****** File ******
export class File extends DartClass {
  path?:string;
  uri?:Uri;
  rawPath?:Uint8List;

  static new(path:string) {
    var v  = new File();
    v.path=path;
    return v;
  }

  static fromUri(uri:Uri) {
    let v = new File();
    v.constructorName = "fromUri";
    v.uri = uri;
    return v;
  }

  static fromRawPath(rawPath:Uint8List) {
    let v = new File();
    v.constructorName = "fromRawPath";
    v.rawPath = rawPath;
    return v;
  }
}



//#endregion

//#region ------- G -------
//****** GradientTransform ******
export class GradientTransform extends DartClass {
  radians?:number;

  static rotation(radians?:number) {
    var v = new GradientTransform();
    v.constructorName = "rotation";
    v.radians=radians;
    return v;
  }
}

//****** Gradient ******
interface GradientConfig {
  center?:Alignment;
  startAngle?:number;
  endAngle?:number;
  colors:Array<Color>;
  stops?:Array<number>;
  tileMode?:TileMode;
  transform?:GradientTransform;


  radius?:number;
  focal?:Alignment;
  focalRadius?:number;

  begin?:Alignment;
  end?:Alignment;
}
export class Gradient extends DartClass {
  center?:Alignment;
  startAngle?:number;
  endAngle?:number;
  colors?:Array<Color>;
  stops?:Array<number>;
  tileMode?:TileMode;
  transform?:GradientTransform;

  //Radial
  radius?:number;
  focal?:Alignment;
  focalRadius?:number;

  //
  begin?:Alignment;
  end?:Alignment;


  /**
   * @param config config: 
      {
        center?:Alignment, 
        startAngle?:number, 
        endAngle?:number, 
        colors:Array<Color>, 
        stops?:Array<number>, 
        tileMode?:TileMode,
        transform?:GradientRotation,
      }
   */
  static sweep(config: GradientConfig) {
    var v = new Gradient();
    v.constructorName = "sweep";
    if(config!=null && config!=undefined){
      v.center = config.center;
      v.startAngle = config.startAngle;
      v.endAngle = config.endAngle;
      v.colors = config.colors;
      v.stops = config.stops;
      v.tileMode = config.tileMode;
      v.transform = config.transform;
    }
    return v;
  }

   /**
   * @param config config: 
      {
        center?:Alignment, 
        radius?:number, 
        colors:Array<Color>, 
        stops?:Array<number>, 
        tileMode?:TileMode, 
        focal?:Alignment, 
        focalRadius?:number,
        transform?:GradientRotation,
      }
   */
  static radial(config?: GradientConfig) {
    var v = new Gradient();
    v.constructorName = "radial";
    if(config!=null && config!=undefined){
      v.center = config.center;
      v.radius = config.radius;
      v.colors = config.colors;
      v.stops = config.stops;
      v.tileMode = config.tileMode;
      v.focal = config.focal;
      v.focalRadius = config.focalRadius;
      v.transform = config.transform;
    }
    return v;
  }

   /**
   * @param config config: 
      {
        begin?:Alignment, 
        end?:Alignment, 
        colors:Array<Color>, 
        stops?:Array<number>, 
        tileMode?:TileMode,
        transform?:GradientRotation,
      }
   */
  static linear(config: GradientConfig) {
    var v = new Gradient();
    v.constructorName = "linear";
    if(config!=null && config!=undefined){
      v.begin = config.begin;
      v.end = config.end;
      v.colors = config.colors;
      v.stops = config.stops;
      v.tileMode = config.tileMode;
      v.transform = config.transform;
    }
    return v;
  }
}

//#endregion

//#region ------- I -------

//****** InputBorder ******
interface InputBorderConfig {
  borderSide?:BorderSide;
  borderRadius?:BorderRadius;
  gapPadding?:number;
}

export class InputBorder extends ShapeBorder {

  borderSide?:BorderSide;
  borderRadius?:BorderRadius;
  gapPadding?:number;

  static none() {
    var v = new InputBorder();
    v.constructorName= "none";
    return v;
  }

  /**
   * @param config config: 
      {
        borderSide?:BorderSide, 
        borderRadius?:BorderRadius, 
        gapPadding?:number,
      }
   */
  static outline(config?: InputBorderConfig) {
    var v = new InputBorder();
    v.constructorName= "outline";
    if(config!=null && config!=undefined){
      v.borderRadius = config.borderRadius;
      v.borderSide = config.borderSide;
      v.gapPadding = config.gapPadding;
    }
    return v;
  }
  
  /**
   * @param config config: 
      {
        borderSide?:BorderSide, 
        borderRadius?:BorderRadius,
      }
   */
  static underline(config?: InputBorderConfig) {
    var v = new InputBorder();
    v.constructorName= "underline";
    if(config!=null && config!=undefined){
      v.borderRadius=config.borderRadius;
      v.borderSide=config.borderSide;
    }
    return v;
  };

}

//****** ImageProvider ******
interface ImageProviderConfig {
  scale?:number;

  width?:number;
  height?:number;
  allowUpscaling?:boolean;

  bundle?:AssetBundle;
  packageName?:string

}
export class ImageProvider extends DartClass {
  file?:File;
  scale?:number;
  bytes?:Uint8List;
  url?:string;
  assetName?:string;
  bundle?:AssetBundle;
  packageName?:string;

  width?:number;
  height?:number;
  allowUpscaling?:boolean;
  imageProvider?:ImageProvider

  /**
   * @param config config: 
      {
        scale?:number
      }
   */
  static file(file:File,config?: ImageProviderConfig){
    var v = new ImageProvider();
    v.file = file;
    v.constructorName = "file";
    if(config!=null && config!=undefined){
      v.scale = config.scale;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        scale?:number,
      }
   */
  static memory(bytes:Uint8List,config?: ImageProviderConfig) {
    var v = new ImageProvider();
    v.bytes = bytes;
    v.constructorName = "memory";
    if(config!=null && config!=undefined){
      v.scale = config.scale;
    }
    return v;
  }

   /**
   * @param config config: 
      {
        scale?:number,
      }
   */
  static network(url:string, config: ImageProviderConfig) {
    var v = new ImageProvider();
    v.url = url;
    v.constructorName = "Network";
    if(config!=null && config!=undefined){
      v.scale = config.scale;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        width?:number, 
        height?:number, 
        allowUpscaling?:boolean, 
      }
   */
  static resize(imageProvider?:ImageProvider,config?: ImageProviderConfig) {
    var v = new ImageProvider();
    v.constructorName = "resize";
    v.imageProvider= imageProvider;
    if(config!=null && config!=undefined){
      v.width = config.width;
      v.allowUpscaling= config.allowUpscaling;
      v.height = config.height;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        assetName:string, 
        scale?:number, 
        bundle?:BaseAssetBundle, 
        packageName?:string,
      }
   */
  static exactAsset(assetName:string,config?: ImageProviderConfig) {
    var v = new ImageProvider();
    v.constructorName = "exactAsset";
    v.assetName = assetName;
    if(config!=null && config!=undefined){      
      v.scale = config.scale;
      v.bundle = config.bundle;
      v.packageName = config.packageName;
    }
    return v;
  }
}

//****** IconData ******
interface IconDataConfig {
  fontFamily?:string;
  fontPackage?:string;
  matchTextDirection?:boolean;
}
export class IconData extends DartClass {
  codePoint?:number;
  fontFamily?:string;
  fontPackage?:string;
  matchTextDirection?:boolean;

  /**
   * @param codePoint codePoint:number
   * @param config config: 
      {
        fontFamily?:string, 
        fontPackage?:string, 
        matchTextDirection?:boolean
      }
   */
  static new(codePoint:number, config?: IconDataConfig) {
    var v = new IconData();
    v.codePoint = codePoint;
    if(config!=null && config!=undefined){
      v.fontFamily = config.fontFamily;
      v.fontPackage = config.fontPackage;
      v.matchTextDirection = config.matchTextDirection;
    }
    return v;
  }
}

//****** IconThemeData ******
interface IconThemeDataConfig {
  color?:Color;
  opacity?:number;
  size?:number;
}
export class IconThemeData extends DartClass {
  color?:Color;
  opacity?:number;
  size?:number;

  /**
   * @param config config: 
      {
        color?:Color, 
        opacity?:number, 
        size?:number
      }
   */
  static new(config?: IconThemeDataConfig) {
    var v =new IconThemeData();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.opacity = config.opacity;
      v.size = config.size;
    }
    return v;
  }
}


//****** ImageShader ******
export class ImageShader extends DartClass {
  image?:ImageProvider;
  tmx?:TileMode;
  tmy?:TileMode;
  matrix4?:Matrix4;
  static new(image:ImageProvider,tmx:TileMode,tmy:TileMode,matrix4:Matrix4) {
    var v = new ImageShader();
    v.image = image;
    v.tmx = tmx;
    v.tmy = tmy;
    v.matrix4 = matrix4;
    return v;
  }
}

//****** InputDecorationTheme ******
interface InputDecorationThemeConfig {
  labelStyle?:TextStyle;
  helperStyle?:TextStyle;
  helperMaxLines?:number;
  hintStyle?:TextStyle;
  errorStyle?:TextStyle;
  errorMaxLines?:number;
  hasFloatingPlaceholder?:boolean;
  floatingLabelBehavior?:FloatingLabelBehavior;
  isDense?:boolean;
  contentPadding?:EdgeInsets;
  isCollapsed?:boolean;
  prefixStyle?:TextStyle;
  suffixStyle?:TextStyle;
  counterStyle?:TextStyle;
  filled?:boolean;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  errorBorder?:InputBorder;
  focusedBorder?:InputBorder;
  focusedErrorBorder?:InputBorder;
  disabledBorder?:InputBorder;
  enabledBorder?:InputBorder;
  border?:InputBorder;
  alignLabelWithHint?:boolean;
}
export class InputDecorationTheme extends DartClass {
  labelStyle?:TextStyle;
  helperStyle?:TextStyle;
  helperMaxLines?:number;
  hintStyle?:TextStyle;
  errorStyle?:TextStyle;
  errorMaxLines?:number;
  hasFloatingPlaceholder?:boolean;
  floatingLabelBehavior?:FloatingLabelBehavior;
  isDense?:boolean;
  contentPadding?:EdgeInsets;
  isCollapsed?:boolean;
  prefixStyle?:TextStyle;
  suffixStyle?:TextStyle;
  counterStyle?:TextStyle;
  filled?:boolean;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  errorBorder?:InputBorder;
  focusedBorder?:InputBorder;
  focusedErrorBorder?:InputBorder;
  disabledBorder?:InputBorder;
  enabledBorder?:InputBorder;
  border?:InputBorder;
  alignLabelWithHint?:boolean;

  /**
   * @param config config: 
      {
        labelStyle?:TextStyle, 
        helperStyle?:TextStyle, 
        helperMaxLines?:number, 
        hintStyle?:TextStyle, 
        errorStyle?:TextStyle, 
        errorMaxLines?:number, 
        hasFloatingPlaceholder?:boolean, 
        floatingLabelBehavior?:FloatingLabelBehavior, 
        isDense?:boolean, 
        contentPadding?:EdgeInsets, 
        isCollapsed?:boolean, 
        prefixStyle?:TextStyle, 
        suffixStyle?:TextStyle, 
        counterStyle?:TextStyle, 
        filled?:boolean, 
        fillColor?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        errorBorder?:InputBorder, 
        focusedBorder?:InputBorder, 
        focusedErrorBorder?:InputBorder, 
        disabledBorder?:InputBorder, 
        enabledBorder?:InputBorder, 
        border?:InputBorder, 
        alignLabelWithHint?:boolean, 
      }
   */
  static new (config?: InputDecorationThemeConfig) {

    var v = new InputDecorationTheme();
    if(config!=null && config!=undefined){
      v.labelStyle = config.labelStyle;
      v.helperStyle = config.helperStyle;
      v.helperMaxLines = config.helperMaxLines;
      v.hintStyle = config.hintStyle;
      v.errorStyle = config.errorStyle;
      v.errorMaxLines = config.errorMaxLines;
      v.hasFloatingPlaceholder = config.hasFloatingPlaceholder;
      v.floatingLabelBehavior = config.floatingLabelBehavior;
      v.isDense = config.isDense;
      v.contentPadding = config.contentPadding;
      v.isCollapsed = config.isCollapsed;
      v.prefixStyle = config.prefixStyle;
      v.suffixStyle = config.suffixStyle;
      v.counterStyle = config.counterStyle;
      v.filled = config.filled;
      v.fillColor = config.fillColor;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.errorBorder = config.errorBorder;
      v.focusedBorder = config.focusedBorder;
      v.focusedErrorBorder = config.focusedErrorBorder;
      v.disabledBorder = config.disabledBorder;
      v.enabledBorder = config.enabledBorder;
      v.border = config.border;
      v.alignLabelWithHint = config.alignLabelWithHint;
    }
    return v;
  }
}

//****** InputDecoration ******
interface InputDecorationConfig {
  icon?:FlutterWidget;
  labelText?:string;
  labelStyle?:TextStyle;
  helperText?:string;
  helperStyle?:TextStyle;
  helperMaxLines?:number;
  hintText?:string;
  hintStyle?:TextStyle;
  hintMaxLines?:number;
  errorText?:string;
  errorStyle?:TextStyle;
  errorMaxLines?:number;
  hasFloatingPlaceholder?:boolean;
  floatingLabelBehavior?:FloatingLabelBehavior;
  isCollapsed?:boolean;
  isDense?:boolean;
  contentPadding?:EdgeInsets;
  prefixIcon?:FlutterWidget;
  prefixIconConstraints?:BoxConstraints;
  prefix?:FlutterWidget;
  prefixText?:string;
  prefixStyle?:TextStyle;
  suffixIcon?:FlutterWidget;
  suffix?:FlutterWidget;
  suffixText?:string;
  suffixStyle?:TextStyle;
  suffixIconConstraints?:BoxConstraints;
  counter?:FlutterWidget;
  counterText?:string;
  counterStyle?:TextStyle;
  filled?:boolean;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  errorBorder?:InputBorder;
  focusedBorder?:InputBorder;
  focusedErrorBorder?:InputBorder;
  disabledBorder?:InputBorder;
  enabledBorder?:InputBorder;
  border?:InputBorder;
  enabled?:boolean;
  semanticCounterText?:string;
  alignLabelWithHint?:boolean;
}
export class InputDecoration extends DartClass {
  icon?:FlutterWidget;
  labelText?:string;
  labelStyle?:TextStyle;
  helperText?:string;
  helperStyle?:TextStyle;
  helperMaxLines?:number;
  hintText?:string;
  hintStyle?:TextStyle;
  hintMaxLines?:number;
  errorText?:string;
  errorStyle?:TextStyle;
  errorMaxLines?:number;
  hasFloatingPlaceholder?:boolean;
  floatingLabelBehavior?:FloatingLabelBehavior;
  isCollapsed?:boolean;
  isDense?:boolean;
  contentPadding?:EdgeInsets;
  prefixIcon?:FlutterWidget;
  prefixIconConstraints?:BoxConstraints;
  prefix?:FlutterWidget;
  prefixText?:string;
  prefixStyle?:TextStyle;
  suffixIcon?:FlutterWidget;
  suffix?:FlutterWidget;
  suffixText?:string;
  suffixStyle?:TextStyle;
  suffixIconConstraints?:BoxConstraints;
  counter?:FlutterWidget;
  counterText?:string;
  counterStyle?:TextStyle;
  filled?:boolean;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  errorBorder?:InputBorder;
  focusedBorder?:InputBorder;
  focusedErrorBorder?:InputBorder;
  disabledBorder?:InputBorder;
  enabledBorder?:InputBorder;
  border?:InputBorder;
  enabled?:boolean;
  semanticCounterText?:string;
  alignLabelWithHint?:boolean;


  /**
   * @param config config: 
      {
        icon?:FlutterWidget, 
        labelText?:string, 
        labelStyle?:TextStyle, 
        helperText?:string, 
        helperStyle?:TextStyle, 
        helperMaxLines?:number, 
        hintText?:string, 
        hintStyle?:TextStyle, 
        hintMaxLines?:number, 
        errorText?:string, 
        errorStyle?:TextStyle, 
        errorMaxLines?:number, 
        hasFloatingPlaceholder?:boolean, 
        floatingLabelBehavior?:FloatingLabelBehavior, 
        isCollapsed?:boolean, 
        isDense?:boolean, 
        contentPadding?:EdgeInsets, 
        prefixIcon?:FlutterWidget, 
        prefixIconConstraints?:BoxConstraints, 
        prefix?:FlutterWidget, 
        prefixText?:string, 
        prefixStyle?:TextStyle, 
        suffixIcon?:FlutterWidget, 
        suffix?:FlutterWidget, 
        suffixText?:string, 
        suffixStyle?:TextStyle, 
        suffixIconConstraints?:BoxConstraints, 
        counter?:FlutterWidget, 
        counterText?:string, 
        counterStyle?:TextStyle, 
        filled?:boolean, 
        fillColor?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        errorBorder?:InputBorder, 
        focusedBorder?:InputBorder, 
        focusedErrorBorder?:InputBorder, 
        disabledBorder?:InputBorder, 
        enabledBorder?:InputBorder, 
        border?:InputBorder, 
        enabled?:boolean, 
        semanticCounterText?:string, 
        alignLabelWithHint?:boolean, 
      }
   */
    static new(config?: InputDecorationConfig) {
      var v = new InputDecoration();
      if(config!=null && config!=undefined){
        v.icon = config.icon;
        v.labelText = config.labelText;
        v.labelStyle = config.labelStyle;
        v.helperText = config.helperText;
        v.helperStyle = config.helperStyle;
        v.helperMaxLines = config.helperMaxLines;
        v.hintText = config.hintText;
        v.hintStyle = config.hintStyle;
        v.hintMaxLines = config.hintMaxLines;
        v.errorText = config.errorText;
        v.errorStyle = config.errorStyle;
        v.errorMaxLines = config.errorMaxLines;
        v.hasFloatingPlaceholder = config.hasFloatingPlaceholder;
        v.floatingLabelBehavior = config.floatingLabelBehavior;
        v.isCollapsed = config.isCollapsed;
        v.isDense = config.isDense;
        v.contentPadding = config.contentPadding;
        v.prefixIcon = config.prefixIcon;
        v.prefixIconConstraints = config.prefixIconConstraints;
        v.prefix = config.prefix;
        v.prefixText = config.prefixText;
        v.prefixStyle = config.prefixStyle;
        v.suffixIcon = config.suffixIcon;
        v.suffix = config.suffix;
        v.suffixText = config.suffixText;
        v.suffixStyle = config.suffixStyle;
        v.suffixIconConstraints = config.suffixIconConstraints;
        v.counter = config.counter;
        v.counterText = config.counterText;
        v.counterStyle = config.counterStyle;
        v.filled = config.filled;
        v.fillColor = config.fillColor;
        v.focusColor = config.focusColor;
        v.hoverColor = config.hoverColor;
        v.errorBorder = config.errorBorder;
        v.focusedBorder = config.focusedBorder;
        v.focusedErrorBorder = config.focusedErrorBorder;
        v.disabledBorder = config.disabledBorder;
        v.enabledBorder = config.enabledBorder;
        v.border = config.border;
        v.enabled = config.enabled;
        v.semanticCounterText = config.semanticCounterText;
        v.alignLabelWithHint = config.alignLabelWithHint;
      }

      return v;
  } 

  

  /**
   * @param config config: 
      {
        hintText?:string, 
        hasFloatingPlaceholder?:boolean, 
        hintStyle?:TextStyle, 
        filled?:boolean, 
        fillColor?:Color, 
        border?:InputBorder, 
        enabled?:boolean 
      }
   */
  static collapsed (config?: InputDecorationConfig) {
    let v = new InputDecoration();
    v.constructorName = "collapsed";

    if(config!=null && config!=undefined){
      v.hintText = config.hintText;
      v.hasFloatingPlaceholder = config.hasFloatingPlaceholder;
      v.hintStyle = config.hintStyle;
      v.filled = config.filled;
      v.fillColor = config.fillColor;
      v.border = config.border;
      v.enabled = config.enabled;
    }

    return v;
  }
}
//#endregion

//#region ------- K -------
//****** Key ******
export class Key extends DartClass {
  value?:string;
  debugLabel?:string;

  static value(value:string) {
    var v = new Key();
    v.constructorName = "value";
    v.value = value;
    return v;
  }

  static unique() {
    var v = new Key();
    v.constructorName = "unique";
    return v;
  }

  static global(debugLabel:string) {
    var v = new Key();
    v.constructorName = "global";
    v.debugLabel = debugLabel;
    return v;
  }
}
//#endregion

//#region ------- L -------
//#endregion

//#region ------- M -------
//****** MaskFilter ******
export class MaskFilter extends DartClass {
  style?:BlurStyle;
  sigma?:number;


  static new(style:BlurStyle, sigma:number) {
    var v = new MaskFilter();
    v.style = style;
    v.sigma = sigma;
    return v;
  }
  static blur(style:BlurStyle, sigma:number) {
    let v = new MaskFilter();
    v.constructorName = "blur";

    v.style = style;
    v.sigma = sigma;
    return v;
  }
}

//****** Matrix4 ******
export class Matrix4 extends DartClass {
  arg0?:number;
  arg1?:number;
  arg2?:number;
  arg3?:number;
  arg4?:number;
  arg5?:number;
  arg6?:number;
  arg7?:number;
  arg8?:number;
  arg9?:number;
  arg10?:number;
  arg11?:number;
  arg12?:number;
  arg13?:number;
  arg14?:number;
  arg15?:number;
  values?:Array<number>;

  v4_0?:Vector4;
  v4_1?:Vector4;
  v4_2?:Vector4;
  v4_3?:Vector4;

  v4_u?:Vector4;
  v4_v?:Vector4;

  radians?:number;
  v3_t?:Vector3;
  v3_s?:Vector3;
  x?:number; 
  y?:number; 
  z?:number;
  alpha?:number;
  beta?:number;
  rotation?:Quaternion;


  scale(x?:any, y?:number, z?:number) {
    let sx = null;
    let sy = null;
    let sz = null;
    let sw = x instanceof Vector4 ? x.w : 1.0;
    if (x instanceof Vector3) {
      sx = x.x;
      sy = x.y;
      sz = x.z;
    } else if (x instanceof Vector4) {
      sx = x.x;
      sy = x.y;
      sz = x.z;
    } else if (typeof x == "number") {
      sx = x;
      sy = y == null ? x : y;
      sz = z == null ? x : z;
    }

    if(this.arg0!=null && this.arg0!=undefined && sx!=null && sx!=undefined){
      this.arg0 = this.arg0 *sx;
    }

    if(this.arg1!=null && this.arg1!=undefined && sx!=null && sx!=undefined){
      this.arg1 = this.arg1 *sx;
    }
    if(this.arg2!=null && this.arg2!=undefined && sx!=null && sx!=undefined){
      this.arg2 = this.arg2 *sx;
    }
    if(this.arg3!=null && this.arg3!=undefined && sx!=null && sx!=undefined){
      this.arg3 = this.arg3 *sx;
    }
    
    if(this.arg4!=null && this.arg4!=undefined && sy!=null && sy!=undefined){
      this.arg4 = this.arg4 *sy;
    }
    if(this.arg5!=null && this.arg5!=undefined && sy!=null && sy!=undefined){
      this.arg5 = this.arg5 *sy;
    }
    if(this.arg6!=null && this.arg6!=undefined && sy!=null && sy!=undefined){
      this.arg6 = this.arg6 *sy;
    }
    if(this.arg7!=null && this.arg7!=undefined && sy!=null && sy!=undefined){
      this.arg7 = this.arg7 *sy;
    }


    if(this.arg8!=null && this.arg8!=undefined && sz!=null && sz!=undefined){
      this.arg8 = this.arg8 *sz;
    }
    if(this.arg9!=null && this.arg9!=undefined && sz!=null && sz!=undefined){
      this.arg9 = this.arg9 *sz;
    }
    if(this.arg10!=null && this.arg10!=undefined && sz!=null && sz!=undefined){
      this.arg10 = this.arg10 *sz;
    }
    if(this.arg11!=null && this.arg11!=undefined && sz!=null && sz!=undefined){
      this.arg11 = this.arg11 *sz;
    }

    if(this.arg12!=null && this.arg12!=undefined && sw!=null && sw!=undefined){
      this.arg12 = this.arg12 *sw;
    }
    if(this.arg13!=null && this.arg13!=undefined && sw!=null && sw!=undefined){
      this.arg13 = this.arg13 *sw;
    }
    if(this.arg14!=null && this.arg14!=undefined && sw!=null && sw!=undefined){
      this.arg14 = this.arg14 *sw;
    }
    if(this.arg15!=null && this.arg15!=undefined && sw!=null && sw!=undefined){
      this.arg15 = this.arg15 *sw;
    }
  }

  static new(arg0:number,arg1:number,arg2:number,arg3:number,arg4:number,arg5:number,arg6:number,arg7:number,
    arg8:number,arg9:number,arg10:number,arg11:number,arg12:number,arg13:number,arg14:number,arg15:number) {
      var v = new Matrix4();
      v.arg0 = arg0;
      v.arg1 = arg1;
      v.arg2 = arg2;
      v.arg3 = arg3;
      v.arg4 = arg4;
      v.arg5 = arg5;
      v.arg6 = arg6;
      v.arg7 = arg7;
      v.arg8 = arg8;
      v.arg9 = arg9;
      v.arg10 = arg10;
      v.arg11 = arg11;
      v.arg12 = arg12;
      v.arg13 = arg13;
      v.arg14 = arg14;
      v.arg15 = arg15;
      return v;
  }

  static identity() {
    return Matrix4.new(1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0,0.0,0.0,0.0,0.0,1.0);
  }

  static fromList(values:Array<number>) {
    let v = new Matrix4();
    v.constructorName = "fromList";
    v.values = values;
    return v;
  }

  static zero() {
    let v = new Matrix4();
    v.constructorName = "zero";
    return v;
  }

  static columns(v4_0:Vector4,v4_1:Vector4,v4_2:Vector4,v4_3:Vector4) {
    let v = new Matrix4();
    v.constructorName = "columns";
  
    v.v4_0 = v4_0;
    v.v4_1 = v4_1;
    v.v4_2 = v4_2;
    v.v4_3 = v4_3;
  
    return v;
  }

  static outer(v4_u:Vector4,v4_v:Vector4) {
    let v = new Matrix4();
    v.constructorName = "outer";
    v.v4_u = v4_u;
    v.v4_v = v4_v;
    return v;
  }

  static rotationX(radians:number) {
    let v = new Matrix4();
    v.constructorName = "rotationX";
  
    v.radians = radians;
  
    return v;
  }

  static rotationY (radians:number) {
    let v = new Matrix4();
    v.constructorName = "rotationY";
  
    v.radians = radians;
    return v;
  }

  static rotationZ(radians:number) {
    let v = new Matrix4();
    v.constructorName = "rotationZ";
    v.radians = radians;
    return v;
  }

   static translation(v3_t:Vector3) {
    let v = new Matrix4();
    v.constructorName = "translation";
  
    v.v3_t = v3_t;
  
    return v;
  }

  static translationValues(x:number, y:number, z:number) {
    let v = new Matrix4();
    v.constructorName = "translationValues";
  
    v.x = x;
    v.y = y;
    v.z = z;
  
    return v;
  }

  static diagonal3(v3_s:Vector3) {
    let v = new Matrix4();
    v.constructorName = "diagonal3";

    v.v3_s = v3_s;

    return v;
  }

  static diagonal3Values(x:number, y:number, z:number) {
    let v = new Matrix4();
    v.constructorName = "diagonal3Values";

    v.x = x;
    v.y = y;
    v.z = z;

    return v;
  }

  static skewX(alpha:number) {
    let v = new Matrix4();
    v.constructorName = "skewX";
  
    v.alpha = alpha;
  
    return v;
  } 

  static skewY(beta:number) {
    let v = new Matrix4();
    v.constructorName = "skewY";
  
    v.beta = beta;
    return v;
  }

  static skew(alpha:number, beta:number) {
    let v = new Matrix4();
    v.constructorName = "skew";
  
    v.alpha = alpha;
    v.beta = beta;
  
    return v;
  }

  static compose(v3_t:Vector3, rotation:Quaternion, v3_s:Vector3) {
    let v = new Matrix4();
    v.constructorName = "compose";

    v.v3_t = v3_t;
    v.rotation = rotation;
    v.v3_s = v3_s;

    return v;
  }
}

//****** TODO MediaQuery ******
export class MediaQuery extends DartClass {
  child?:FlutterWidget;
  data?:MediaQueryData;
  key?:Key;

  static new(child:FlutterWidget, data:MediaQueryData, key?:Key,) {
    var v = new MediaQuery();
    v.key = key;
    v.data = data; //MediaQueryData
    v.child = child;
    return new MediaQuery();
  };

  static of(context:any) {
    return context.mediaQueryData;
  }
}

//****** TODO MediaQueryData ******
interface MediaQueryDataConfig {
  size?:Size;
  devicePixelRatio?:number;
  textScaleFactor?:number;
  platformBrightness?:Brightness;
  padding?:EdgeInsets;
  viewInsets?:EdgeInsets;
  alwaysUse24HourFormat?:boolean;
  accessibleNavigation?:boolean;
  invertColors?:boolean;
  highContrast?:boolean;
  disableAnimations?:boolean;
  boldText?:boolean;
  navigationMode?:NavigationMode;
}
export class MediaQueryData extends DartClass {
  size?:Size;
  devicePixelRatio?:number;
  textScaleFactor?:number;
  platformBrightness?:Brightness;
  padding?:EdgeInsets;
  viewInsets?:EdgeInsets;
  alwaysUse24HourFormat?:boolean;
  accessibleNavigation?:boolean;
  invertColors?:boolean;
  highContrast?:boolean;
  disableAnimations?:boolean;
  boldText?:boolean;
  navigationMode?:NavigationMode;


  /**
   * @param config config: 
      {
        size?:Size, 
        devicePixelRatio?:number, 
        textScaleFactor?:number, 
        platformBrightness?:Brightness, 
        padding?:EdgeInsets,
        viewInsets?:EdgeInsets, 
        alwaysUse24HourFormat?:boolean, 
        accessibleNavigation?:boolean, 
        invertColors?:boolean,
        highContrast?:boolean, 
        disableAnimations?:boolean, 
        boldText?:boolean, 
        navigationMode?:NavigationMode
      }
   */
  static new(config: MediaQueryDataConfig) {
      var v = new MediaQueryData();
      if(config!=null && config!=undefined){
        v.size = config.size;
        v.devicePixelRatio = config.devicePixelRatio;
        v.textScaleFactor = config.textScaleFactor;
        v.padding = config.padding;
        v.viewInsets = config.viewInsets;
        v.alwaysUse24HourFormat = config.alwaysUse24HourFormat;
        v.accessibleNavigation = config.accessibleNavigation;
        v.invertColors = config.invertColors;
        v.disableAnimations = config.disableAnimations;
        v.boldText = config.boldText;
        v.platformBrightness = config.platformBrightness;
        v.highContrast = config.highContrast;
        v.navigationMode= config.navigationMode;
      }
      return v;
  }
}

//#endregion

//#region ------- N -------
//****** NeverScrollableScrollPhysics ******
export class NeverScrollableScrollPhysics extends DartClass {
  parent?:NeverScrollableScrollPhysics;
  static new(parent?:NeverScrollableScrollPhysics) {
    var v = new NeverScrollableScrollPhysics();
    v.parent = parent;
    return v;
  }
}

//****** TODO Notification ******
export class Notification extends DartClass {
  static new() {
    return new Notification();
  }
}

//****** NotchedShape ******
interface NotchedShapeConfig {

}
export class NotchedShape extends DartClass {
  host?:ShapeBorder;

  static circular() {
    var v = new NotchedShape();
    v.constructorName = "circular";
    return v;
  }


  static automatic(host:ShapeBorder) {
    var v = new NotchedShape();
    v.host = host;
    return v;
  }
}

//#endregion

//#region ------- O -------
//****** Offset ******
export class Offset extends DartClass {
  dx?:number;
  dy?:number;
  direction?:number;

  static new(dx:number, dy:number) {
    var v = new Offset();
    v.dx = dx;
    v.dy = dy;
    return v;
  }

  static zero() {
    let v = new Offset();
    v.constructorName = "zero";
    return v;
  }

  static infinite() {
    let v = new Offset();
    v.constructorName = "infinite";
    return v;
  }

  static fromDirection(direction:number,) {
    let v = new Offset();
    v.constructorName = "fromDirection";
    v.direction = direction;
    return v;
  }
}


//****** OutlinedBorder ******
interface OutlinedBorderConfig {
  side?:BorderSide;
  borderRadius?:BorderRadius;
}
export class OutlinedBorder extends ShapeBorder {
  side?:BorderSide;

  borderRadius?:BorderRadius;

  /**
   * @param config config: 
      {
        side?:BorderSide,
      }
   */
  static circleBorder(config?: OutlinedBorderConfig) {
    var v = new OutlinedBorder();
    v.constructorName = "circleBorder";
    if(config!=null && config!=undefined){
      v.side = config.side;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        side?:BorderSide,
        borderRadius?:BorderRadius,
      }
   */
  static beveledRectangleBorder(config?: OutlinedBorderConfig) {
    var v = new OutlinedBorder();
    v.constructorName = "beveledRectangleBorder";
    if(config!=null && config!=undefined){
      v.side = config.side;
      v.borderRadius = config.borderRadius;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        side?:BorderSide,
        borderRadius?:BorderRadius,
      }
   */
  static continuousRectangleBorder(config?: OutlinedBorderConfig) {
    var v = new OutlinedBorder();
    v.constructorName = "continuousRectangleBorder";
    if(config!=null && config!=undefined){
      v.side = config.side;
      v.borderRadius = config.borderRadius;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        side?:BorderSide,
        borderRadius?:BorderRadius,
      }
   */
  static roundedRectangleBorder(config?: OutlinedBorderConfig) {
    var v = new OutlinedBorder();
    v.constructorName = "roundedRectangleBorder";
    if(config!=null && config!=undefined){
      v.side = config.side;
      v.borderRadius = config.borderRadius;
    }
    return v;
  }

   /**
   * @param config config: 
      {
        side?:BorderSide,
      }
   */
  static stadiumBorder(config?: OutlinedBorderConfig) {
    var v = new OutlinedBorder();
    v.constructorName = "stadiumBorder";
    if(config!=null && config!=undefined){
      v.side = config.side;
    }
    return v;
  }
}


//#endregion

//#region ------- P -------
//#endregion

//#region ------- Q -------
//****** Quaternion ******
export class Quaternion extends DartClass {
  x?:number;
  y?:number;
  z?:number;
  w?:number;
  static new(x:number, y:number, z:number, w:number) {
    var v = new Quaternion();
    v.x = x;
    v.y = y;
    v.z = z;
    v.w = w;
    return v;
  }
}
//#endregion

//#region ------- R -------
//****** Radius ******
export class Radius extends DartClass {
  radius?:number;
  x?:number;
  y?:number;

  static circular(radius:number) {
    let v = new Radius();
    v.constructorName = "circular";
    v.radius = radius;
    return v;
  }

  static elliptical(x:number, y:number) {
    let v = new Radius();
    v.constructorName = "elliptical";
    v.x = x;
    v.y = y;
    return v;
  }

  static zero() {
    let v = new Radius();
    v.constructorName = "zero";
    return v;
  }
}

//****** Rect ******
interface RectConfig {
  center?:Offset;
  width?:number;
  height?:number;
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  radius?:number;
  a?:Offset;
  b?:Offset;
}
export class Rect extends DartClass {
  center?:Offset;
  width?:number;
  height?:number;
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  radius?:number;
  a?:Offset;
  b?:Offset;

  /**
   * @param config config: 
      {
        center?:Offset, 
        width?:number,
        height?:number
      }
   */
  static fromCenter (config: RectConfig) {
    let v = new Rect();
    v.constructorName = "fromCenter";
    if(config!=null && config!=undefined){
      v.center = config.center;
      v.width = config.width;
      v.height = config.height;  
    }
    return v;
  }

  static fromLTRB(left:number, top:number, right:number, bottom:number) {
    let v = new Rect();
    v.constructorName = "fromLTRB";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;  
    return v;
  }
  
  static fromLTWH(left:number, top:number, width:number, height:number) {
    let v = new Rect();
    v.constructorName = "fromLTWH";

    v.left = left;
    v.top = top;
    v.width = width;
    v.height = height;

    return v;
  }

  /**
   * @param config config: 
    {
      center?:Offset, 
      radius?:number
    }
   */
  static fromCircle(config: RectConfig) {
    let v = new Rect();
    v.constructorName = "fromCircle";
    if(config!=null && config!=undefined){
      v.center = config.center;
      v.radius = config.radius;
    }
    return v;
  }


  static fromPoints (a:Offset,b:Offset) {
    let v = new Rect();
    v.constructorName = "fromPoints";
      v.a = a;
      v.b = b;
    return v;
  }

  static zero() {
    let v = new Rect();
    v.constructorName = "zero";
    return v;
  }

  static largest() {
    let v = new Rect();
    v.constructorName = "largest";
    return v;
  }
}

//****** RelativeRect ******
export class RelativeRect extends DartClass {
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;

  rect?:Rect;
  rect1?:Rect;
  container?:Size;

  static fromLTRB(left:number, top:number, right:number, bottom:number) {
    let v = new RelativeRect();
    v.constructorName = "fromLTRB";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;  
    return v;
  }

  static fromSize(rect:Rect,container:Size) {
    let v = new RelativeRect();
    v.constructorName = "fromSize";
    v.rect = rect;
    v.container = container;
    return v;
  }

  static fromRect(rect:Rect,rect1:Rect) {
    let v = new RelativeRect();
    v.constructorName = "fromRect";
    v.rect = rect;
    v.rect1 = rect1;
    return v;
  }

  static fill() {
    let v = new RelativeRect();
    v.constructorName = "fill";
    return v;
  }
}

//****** RRect ******
interface RRectConfig {
  topLeft?:Radius;
  topRight?:Radius;
  bottomRight?:Radius;
  bottomLeft?:Radius;
}
export class RRect extends DartClass {
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  radiusX?:number;
  radiusY?:number;
  radius?:Radius;
  rect?:Rect;

  topLeft?:Radius;
  topRight?:Radius;
  bottomRight?:Radius;
  bottomLeft?:Radius;


  static fromLTRBXY(left:number,top:number, right:number,  bottom:number, radiusX:number, radiusY:number) {
    let v = new RRect();
    v.constructorName = "fromLTRBXY";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;  
    v.radiusX = radiusX;
    v.radiusY = radiusY;
    return v;

  }

  static fromLTRBR(left:number,top:number, right:number,  bottom:number, radius:Radius) {
    let v = new RRect();
    v.constructorName = "fromLTRBR";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;  
    v.radius = radius;
    return v;
  }

  static fromRectXY(rect:Rect, radiusX:number, radiusY:number) {
    let v = new RRect();
    v.constructorName = "fromRectXY";
    v.rect = rect;
    v.radiusX = radiusX;
    v.radiusY = radiusY;

    return v;
  }

  static fromRectAndRadius(rect:Rect, radius:Radius) {
    let v = new RRect();
    v.constructorName = "fromRectAndRadius";
    v.rect = rect;
    v.radius = radius;

    return v;
  }

  /**
   * @param config config: 
    {
      topLeft?:Radius, 
      topRight?:Radius, 
      bottomRight?:Radius, 
      bottomLeft?:Radius,
    }
   */
  static fromLTRBAndCorners(left:number,top:number, right:number,  bottom:number, config?: RRectConfig) {
    let v = new RRect();
    v.constructorName = "fromLTRBAndCorners";
    v.left = left;
    v.top = top;
    v.right = right;
    v.bottom = bottom;
    if(config!=null && config!=undefined){
      v.topLeft = config.topLeft;
      v.topRight = config.topRight;
      v.bottomLeft = config.bottomLeft;
      v.bottomRight = config.bottomRight;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      topLeft?:Radius, 
      topRight?:Radius, 
      bottomRight?:Radius, 
      bottomLeft?:Radius,
    }
   */
  static fromRectAndCorners(rect:Rect, config?: RRectConfig) {
    let v = new RRect();
    v.constructorName = "fromRectAndCorners";
    v.rect = rect;
    if(config!=null && config!=undefined){
      v.topLeft = config.topLeft;
      v.topRight = config.topRight;
      v.bottomLeft = config.bottomLeft;
      v.bottomRight = config.bottomRight;
    }
    return v;
  }

  static zero() {
    let v = new RRect();
    v.constructorName = "zero";
    return v;
  }
}

//****** RSTransform ******
interface RSTransformConfig {
  rotation:number;
  scale:number;
  anchorX:number;
  anchorY:number;
  translateX:number;
  translateY:number;
}
export class RSTransform extends DartClass {
  
  rotation?:number;
  scale?:number;
  anchorX?:number;
  anchorY?:number;
  translateX?:number;
  translateY?:number;

  scos?:number;
  ssin?:number;
  tx?:number;
  ty?:number;

  /**
   * @param config config: 
      {
        rotation?:number, 
        scale?:number, 
        anchorX?:number, 
        anchorY?:number, 
        translateX?:number, 
        translateY?:number, 
      }
   */
  static fromComponents (config: RSTransformConfig) {
    let v = new RSTransform();
    v.constructorName = "fromComponents";
    if(config!=null && config!=undefined){
      v.rotation =config.rotation;
      v.scale   = config.scale;
      v.anchorX = config.anchorX;
      v.anchorY = config.anchorY;
      v.translateX= config.translateX;
      v.translateY = config.translateY;
    }
    return v;
  }

  static new(scos:number, ssin:number, tx:number, ty:number) {
    let v = new RSTransform();
    v.scos = scos;
    v.ssin = ssin;
    v.tx = tx;
    v.ty = ty;  
    return v;
  }
  
}


//****** RangeMaintainingScrollPhysics ******
export class RangeMaintainingScrollPhysics extends DartClass {
  parent?:ScrollPhysics;
  static new(config?: ScrollPhysicsConfig) {
    var v = new RangeMaintainingScrollPhysics();
    if(config!=null && config!=undefined){
      v.parent = config.parent;
    }
    return v;
  }
}

//#endregion

//#region ------- S -------
//****** Size ******
export class Size extends DartClass {
  width?:number;
  height?:number;
  dimension?:number;
  radius?:number;
  static new(width:number, height:number) {
    var v = new Size();
    v.width = width;
    v.height = height;
    return v;
  }

  static fromHeight(height:number){
    let v = new Size();
    v.constructorName = "fromHeight";
    v.height=height;
    return v;
  }

  static fromWidth(width:number) {
    let v = new Size();
    v.constructorName = "fromWidth";
    v.width=width;
    return v;
  }

  static square (dimension:number) {
    let v = new Size();
    v.constructorName = "square";
    v.dimension=dimension;
    return v;
  }

  static fromRadius (radius:number){
    let v = new Size();
    v.constructorName = "fromRadius";
    v.radius=radius;
    return v;
  }

  static zero(){
    let v = new Size();
    v.constructorName = "zero";
    return v;
  }

  static infinite(){
    let v = new Size();
    v.constructorName = "infinite";
    return v;
  }
}

//****** StrutStyle ******
interface StrutStyleConfig {
  fontFamily?:string;
  fontFamilyFallback?:Array<string>;
  fontSize?:number;
  height?:number;
  leading?:number;
  fontWeight?:FontWeight;
  fontStyle?:FontStyle;
  forceStrutHeight?:boolean;
  debugLabel?:string;
  packageName?:string;
}
export class StrutStyle extends DartClass {
  fontFamily?:string;
  fontFamilyFallback?:Array<string>;
  fontSize?:number;
  height?:number;
  leading?:number;
  fontWeight?:FontWeight;
  fontStyle?:FontStyle;
  forceStrutHeight?:boolean;
  debugLabel?:string;
  packageName?:string;

  /**
   * @param config config: 
      {
        fontFamily?:string, 
        fontFamilyFallback?:Array<string>, 
        fontSize?:number, 
        height?:number, 
        leading?:number, 
        fontWeight?:FontWeight, 
        fontStyle?:FontStyle, 
        forceStrutHeight?:boolean, 
        debugLabel?:string, 
        packageName?:string, 
      }
   */
  static new(config: StrutStyleConfig) {
    var v = new StrutStyle();
    if(config!=null && config!=undefined){
      v.fontFamily = config.fontFamily;
      v.fontFamilyFallback = config.fontFamilyFallback;
      v.fontSize = config.fontSize;
      v.height = config.height;
      v.leading = config.leading;
      v.fontWeight = config.fontWeight;
      v.fontStyle = config.fontStyle;
      v.forceStrutHeight = config.forceStrutHeight;
      v.debugLabel = config.debugLabel;
      v.packageName =config.packageName;
    }
    return v;
  }
}

//****** SystemUiOverlayStyle ******
interface SystemUiOverlayStyleConfig {
  systemNavigationBarColor?:Color;
  systemNavigationBarDividerColor?:Color;
  statusBarColor?:Color;
  systemNavigationBarIconBrightness?:Brightness;
  statusBarBrightness?:Brightness;
  statusBarIconBrightness?:Brightness;
}
export class SystemUiOverlayStyle extends DartClass {
  systemNavigationBarColor?:Color;
  systemNavigationBarDividerColor?:Color;
  statusBarColor?:Color;
  systemNavigationBarIconBrightness?:Brightness;
  statusBarBrightness?:Brightness;
  statusBarIconBrightness?:Brightness;

  /**
   * @param config config: 
      {
        systemNavigationBarColor?:Color, 
        systemNavigationBarDividerColor?:Color, 
        statusBarColor?:Color,
        systemNavigationBarIconBrightness?:Brightness, 
        statusBarBrightness?:Brightness, 
        statusBarIconBrightness?:Brightness
      }
   */
  static new(config: SystemUiOverlayStyleConfig) {
        var v = new SystemUiOverlayStyle();
        if(config!=null && config!=undefined){
          v.systemNavigationBarColor = config.systemNavigationBarColor;
          v.systemNavigationBarDividerColor = config.systemNavigationBarDividerColor;
          v.systemNavigationBarIconBrightness = config.systemNavigationBarIconBrightness;
          v.statusBarColor = config.statusBarColor;
          v.statusBarBrightness = config.statusBarBrightness;
          v.statusBarIconBrightness = config.statusBarIconBrightness;
        }
        return v;
  }

  static light = SystemUiOverlayStyle.new({
    systemNavigationBarColor:Color.new(0xff000000),
    systemNavigationBarIconBrightness:Brightness.light,
    statusBarBrightness:Brightness.light,
    statusBarIconBrightness:Brightness.dark
  });

  static dark = SystemUiOverlayStyle.new({
    systemNavigationBarColor:Color.new(0xff000000),
    systemNavigationBarIconBrightness:Brightness.light,
    statusBarBrightness:Brightness.dark,
    statusBarIconBrightness:Brightness.light
  });
}

//****** SpringDescription ******
interface SpringDescriptionConfig {
  mass:number;
  stiffness:number; 
  damping:number;
}
export class SpringDescription extends DartClass {
  mass?:number;
  stiffness?:number; 
  damping?:number;

  /**
   * @param config config: 
      {
        mass?:number,
        stiffness?:number,
        damping?:number
      }
   */
  static new(config: SpringDescriptionConfig) {
    var v = new SpringDescription();
    if(config!=null && config!=undefined){
      v.mass = config.mass;
      v.stiffness = config.stiffness;
      v.damping = config.damping;
    }
    return v;
  }
}

//****** ScrollPhysics ******
interface ScrollPhysicsConfig {
  parent?:ScrollPhysics;
}
export class ScrollPhysics extends DartClass {
  parent?:ScrollPhysics;
  static new(config?: ScrollPhysicsConfig) {
    var v = new ScrollPhysics();
    if(config!=null && config!=undefined){
      v.parent = config.parent;
    }
    return v;
  }
}

//****** TODO ScrollController ******
interface ScrollControllerConfig {
  duration?:Duration;
  curve?:Curve;
  initialScrollOffset?:number;
  keepScrollOffset?:boolean;
  debugLabel?:string;
}
// Todo:
export class ScrollController extends DartClass {
  initialScrollOffset?:number;
  keepScrollOffset?:boolean;
  debugLabel?:string;

  /**
   * @param config config: 
      {
        duration?:Duration, 
        curve?:Curves
      }
   */
  animateTo(offset:Offset,config?: ScrollControllerConfig) {
    var map = new Map();
    map.set("offset",offset);
    if(config!=null && config!=undefined){
      if(config.duration!=null && config.duration!=undefined){
        map.set("duration",config.duration);
      }

      if(config.curve!=null && config.curve!=undefined){
        map.set("curve",config.curve);
      }
    }

    let argument = JSCallArgs.new({mirrorID:this.mirrorID,className:"ScrollController",funcName:"animateTo",args:map});
    /*
    let argument = new FlutterCallArgs({
      mirrorID: v.mirrorID,
      className: "ScrollController",
      funcName: "animateTo",
      args: {
        offset: offset,
        duration: duration,
        curve:curve
      }
    });*/
    //invokeFlutterFunction(argument);
  }

  jumpTo(value:number) {
    var args=new Map();
    args.set("value",value);

    let argument=JSCallArgs.new({mirrorID:this.mirrorID,className:"ScrollController",funcName:"jumpTo",args:args});
    JSFramework.invokeFlutterFunction(argument);
  }

  /**
   * @param config config: 
      {
        initialScrollOffset?:number, 
        keepScrollOffset?:boolean, 
        debugLabel?:string
      }
   */
  static new(config: ScrollControllerConfig) {
    var v = new ScrollController();
    v.createMirrorID();
    if(config!=null && config!=undefined){
      v.initialScrollOffset = config.initialScrollOffset;
      v.keepScrollOffset = config.keepScrollOffset;
      v.debugLabel = config.debugLabel;
    }
    return v;
  }
}

//****** Shadow ******
interface ShadowConfig {
  color?:Color;
  offset?:Offset;
  blurRadius?:number;
}
export class Shadow extends DartClass {
  color?:Color;
  offset?:Offset;
  blurRadius?:number;

  /**
   * @param config config: 
      {
        color?:Color, 
        offset?:Offset, 
        blurRadius?:number
      }
   */
  static new(config?: ShadowConfig) {
    var v = new Shadow();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.blurRadius = config.blurRadius;
      v.offset = config.offset;
    }
    return v;
  }
}

//****** ScrollbarPainter ******
interface ScrollbarPainterConfig {
  color:Color;
  textDirection:TextDirection;
  thickness:number;
  fadeoutOpacityAnimation:any;
  padding?:EdgeInsets;
  mainAxisMargin?:number,
  crossAxisMargin?:number;
  radius?:Radius;
  minLength?:number;
  minOverscrollLength?:number;
}
export class ScrollbarPainter extends DartClass {
  color?:Color;
  textDirection?:TextDirection;
  thickness?:number;
  fadeoutOpacityAnimation?:any;
  padding?:EdgeInsets;
  mainAxisMargin?:number;
  crossAxisMargin?:number;
  radius?:Radius;
  minLength?:number;
  minOverscrollLength?:number;

  /**
   * @param config config: 
      {
        color?:Color, 
        textDirection?:TextDirection, 
        thickness?:number, 
        fadeoutOpacityAnimation?:any, 
        padding?:EdgeInsets, 
        mainAxisMargin?:number,
        crossAxisMargin?:number, 
        radius?:Radius, 
        minLength?:number, 
        minOverscrollLength?:number,  
      }
   */
  static new(config: ScrollbarPainterConfig) {
    var v = new ScrollbarPainter();
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.textDirection = config.textDirection;
      v.thickness = config.thickness;
      v.fadeoutOpacityAnimation = config.fadeoutOpacityAnimation;
      v.padding = config.padding;
      v.mainAxisMargin = config.mainAxisMargin;
      v.crossAxisMargin = config.crossAxisMargin;
      v.radius = config.radius;
      v.minLength = config.minLength;
      v.minOverscrollLength = config.minOverscrollLength;
    }
    return v;
  }
}
//#endregion

//#region ------- T -------
//****** TextAlignVertical ******
export class TextAlignVertical extends DartClass {
  y?:number;
  
  static new(y:number){
    var v = new TextAlignVertical();
    v.y=y;
    return v;
  }

  static top = TextAlignVertical.new(-1.0); 
  static center = TextAlignVertical.new(0.0); 
  static bottom = TextAlignVertical.new(1.0); 
} 


//****** TextStyle ******
interface TextStyleConfig {
  inherit?:boolean;
  color?:Color;
  backgroundColor?:Color;
  fontSize?:number;
  fontWeight?:FontWeight;
  fontStyle?:FontStyle;
  letterSpacing?:number;
  wordSpacing?:number;
  textBaseline?:TextBaseline;
  height?:number;
  decoration?:TextDecoration;
  decorationColor?:Color;
  decorationStyle?:TextDecorationStyle;
  decorationThickness?:number;
  debugLabel?:string;
  fontFamily?:string;
  packageName?:string;
}
export class TextStyle extends DartClass {
  inherit?:boolean;
  color?:Color;
  backgroundColor?:Color;
  fontSize?:number;
  fontWeight?:FontWeight;
  fontStyle?:FontStyle;
  letterSpacing?:number;
  wordSpacing?:number;
  textBaseline?:TextBaseline;
  height?:number;
  decoration?:TextDecoration;
  decorationColor?:Color;
  decorationStyle?:TextDecorationStyle;
  decorationThickness?:number;
  debugLabel?:string;
  fontFamily?:string;
  packageName?:string;

  /**
   * @param config config: 
      {
        inherit?:boolean, 
        color?:Color, 
        backgroundColor?:Color, 
        fontSize?:number, 
        fontWeight?:FontWeight, 
        fontStyle?:FontStyle, 
        letterSpacing?:number, 
        wordSpacing?:number, 
        textBaseline?:TextBaseline, 
        height?:number, 
        decoration?:TextDecoration, 
        decorationColor?:Color, 
        decorationStyle?:TextDecorationStyle, 
        decorationThickness?:number, 
        debugLabel?:string, 
        fontFamily?:string, 
        packageName?:string, 
      }
   */
  static new (config?: TextStyleConfig) {
    var v = new TextStyle();
    if(config!=null && config!=undefined){
      v.inherit = config.inherit;
      v.color = config.color;
      v.backgroundColor = config.backgroundColor;
      v.fontSize = config.fontSize;
      v.fontWeight = config.fontWeight;
      v.fontStyle = config.fontStyle;
      v.letterSpacing = config.letterSpacing;
      v.wordSpacing = config.wordSpacing;
      v.textBaseline = config.textBaseline;
      v.height = config.height;
      v.decoration = config.decoration;
      v.decorationColor = config.decorationColor;
      v.decorationStyle = config.decorationStyle;
      v.decorationThickness = config.decorationThickness;
      v.debugLabel = config.debugLabel;
      v.fontFamily = config.fontFamily;
      v.packageName = config.packageName;
    }
    return v;
  }
}

//****** TableRow ******
interface TableBorderConfig {
  top?:BorderSide;
  right?:BorderSide;
  bottom?:BorderSide;
  left?:BorderSide;
  horizontalInside?:BorderSide;
  verticalInside?:BorderSide;

  color?:Color;
  width?:number;
  style?:BorderStyle;

  inside?:BorderSide;
  outside?:BorderSide;
}
export class TableBorder extends DartClass {
  top?:BorderSide;
  right?:BorderSide;
  bottom?:BorderSide;
  left?:BorderSide;
  horizontalInside?:BorderSide;
  verticalInside?:BorderSide;

  color?:Color;
  width?:number;
  style?:BorderStyle;

  inside?:BorderSide;
  outside?:BorderSide;

  /**
   * @param config config: 
    {
      top?:BorderSide, 
      right?:BorderSide, 
      bottom?:BorderSide, 
      left?:BorderSide, 
      horizontalInside?:BorderSide, 
      verticalInside?:BorderSide
    }
   */
  static new(config?: TableBorderConfig) {
    var v = new TableBorder();
    if(config!=null && config!=undefined){
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.left = config.left;
      v.horizontalInside = config.horizontalInside;
      v.verticalInside = config.verticalInside;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      color?:Color, 
      width?:number, 
      style?:BorderStyle, 
    }
   */
  static all(config?: TableBorderConfig) {
    let v = new TableBorder();
    v.constructorName = "all";
    if(config!=null && config!=undefined){
      v.color = config.color;
      v.width = config.width;
      v.style = config.style;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      inside?:BorderSide, 
      outside?:BorderSide
    }
   */
  static symmetric(config?: TableBorderConfig) {
    let v = new TableBorder();
    v.constructorName = "symmetric";
    if(config!=null && config!=undefined){
      v.inside = config.inside;
      v.outside = config.outside;
    }
    return v;
  }
}

//****** TODO TableRow ******
export class TableColumnWidth extends DartClass {
  static new() {
    return new TableColumnWidth();
  }
}

//****** TabController ******
interface TabControllerConfig {
  initialIndex?:number;
  length?:number;
  vsync?:any;
}
export class TabController extends DartClass {
  initialIndex?:number;
  length?:number;
  vsync?:any;

  /**
   * @param config config: 
    {
      initialIndex?:number,
      length?:number,
      vsync?:any
    }
   */
  static new (config?: TabControllerConfig) {
    var v = new TabController();
    if(config!=null && config!=undefined){
      v.initialIndex = config.initialIndex;
      v.length = config.length;
      v.vsync = config.vsync;
    }
    return v;
  }
}

//****** TODO TextEditingController ******
export class TextEditingController extends DartClass {
  text?:string;

  static new(text?:string) {
    var v = new TextEditingController();
    v.text=text;
    return v;
  }
}

//****** TextInputType ******
interface TextInputTypeConfig {
  signed?:boolean;
  decimal?:boolean;
}
export class TextInputType extends DartClass {
  
  signed?:boolean;
  decimal?:boolean;

  static new(){
    return new TextInputType();
  };

  static numberWithOptions(config?: TextInputTypeConfig) {
    let v = new TextInputType();
    v.constructorName = "numberWithOptions";
    if(config!=null && config!=undefined){
      v.signed = config.signed;
      v.decimal = config.decimal;
    }
  
    
  
    return v;
  }

  static text() {
    let v = new TextInputType();
    v.constructorName = "text";
    return v;
  }

  static multiline() {
    let v = new TextInputType();
    v.constructorName = "multiline";
    return v;
  }

  static number() {
    let v = new TextInputType();
    v.constructorName = "number";
  
    return v;
  }

  static phone() {
    let v = new TextInputType();
    v.constructorName = "phone";
  
    return v;
  }

  static datetime() {
    let v = new TextInputType();
    v.constructorName = "datetime";
  
    return v;
  }

  static emailAddress() {
    let v = new TextInputType();
    v.constructorName = "emailAddress";
  
    return v;
  }

  static url(){
    let v = new TextInputType();
    v.constructorName = "url";
    return v;
  }

}

//****** TODO Tween ******
export class Tween extends DartClass {
  begin?:number;
  end?:number;
  
  lerp(t:number) {
    //return dart.dsend(this.begin, '+', [dart.dsend(dart.dsend(this.end, '-', [this.begin]), '*', [t])]);
  }
  transform(t:number) {
    if (t == 0.0) return this.begin;
    if (t == 1.0) return this.end;
    return this.lerp(t);
  }

  static new(begin?:number, end?:number) {
    var v = new Tween();
    v.begin = begin;
    v.end = end;
    return v;
  };
}
//#endregion

//#region ------- U -------

//****** Uri ******
interface UriConfig {
  scheme?:string;
  fragment?:string;
  userInfo?:string;
  host?:string;
  port?:number;
  path?:string;
  query?:string;
}
export class Uri extends DartClass {
  scheme?:string;
  fragment?:string;
  userInfo?:string;
  host?:string;
  port?:number;
  path?:string;
  query?:string;

  /**
   * @param config config: 
    {
      scheme?:string,
      fragment?:string,
      userInfo?:string, 
      host?:string, 
      port?:number, 
      path?:string, 
      query?:string
    }
   */
  static new(config?: UriConfig){
    var v = new Uri();
    if(config!=null && config!=undefined){
      v.scheme = config.scheme;
      v.fragment = config.fragment;
      v.userInfo = config.userInfo;
      v.host = config.host;
      v.port = config.port;
      v.path = config.path;
      v.query = config.query;
    }
    return v;
  }
}

//****** VerticalDirection ******
export class Uint8List extends DartClass {
  length?:number;
  elements?:Array<number>;
  static new(length?:number) {
    var v = new Uint8List();
    v.length = length;
    return v;
  }

  static fromList(elements?:Array<number>) {
    let v = new Uint8List();
    v.constructorName = "fromList";
    v.elements = elements;
  
    return v;
  }
}


//#endregion

//#region ------- V -------
//****** Vector3 ******
export class Vector3 extends DartClass {
  x?:number;
  y?:number;
  z?:number;
  value?:number;
  static new(x:number, y:number, z:number) {
    var v = new Vector3();
    v.x = x;
    v.y = y;
    v.z = z;
    return v;
  }

  static zero(){
    let v = new Vector3();
    v.constructorName = "zero";
    return v;
  }

  static all(value:number) {
    let v = new Vector3();
    v.constructorName = "all";
    v.value = value;
    return v;
  }
}

//****** Vector4 ******
export class Vector4 extends DartClass {
  x?:number;
  y?:number;
  z?:number;
  w?:number;
  array?:Array<number>;
  offset?:Offset;

  static new(x?:number,y?:number,z?:number,w?:number) {
    var v = new Vector4();
    v.x = x;
    v.y = y;
    v.z = z;
    v.w = w;
    return v;
  }

  static array (array?:Array<number>, offset?:Offset) {
    let v = new Vector4();
    v.constructorName = "array";
    v.array = array;
    v.offset = offset;  
    return v;
  }

  static identity() {
    let v = new Vector4();
    v.constructorName = "identity";
    return v;
  }

  static random() {
    let v = new Vector4();
    v.constructorName = "random";
    return v;
  }
}

//****** VisualDensity ******
interface VisualDensityConfig {
  horizontal?:number;
  vertical?:number;
}
export class VisualDensity extends DartClass {
  horizontal?:number;
  vertical?:number;
  
  /**
   * @param config config: 
    {
      horizontal?:number,
      vertical?:number, 
    }
   */
  static new(config?: VisualDensityConfig) {
    var v = new VisualDensity();
    if(config!=null && config!=undefined){
      v.horizontal=config.horizontal;
      v.vertical=config.vertical;
    }
    return v;
  }

  static comfortable =  VisualDensity.new({horizontal: -1.0, vertical: -1.0});
  static compact = VisualDensity.new({horizontal: -2.0, vertical: -2.0});
  static standard = VisualDensity.new();
} 
//#endregion

//#endregion


//#region ******* Icons ********
export class Icons extends IconData{
  /// <i class="material-icons md-36">360</i> &#x2014; material icon named "360".
  static threesixty = IconData.new(0xe577, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">3d_rotation</i> &#x2014; material icon named "3d rotation".
  static threed_rotation = IconData.new(0xe84d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">4k</i> &#x2014; material icon named "4k".
  static four_k = IconData.new(0xe072, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">ac_unit</i> &#x2014; material icon named "ac unit".
  static ac_unit = IconData.new(0xeb3b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">access_alarm</i> &#x2014; material icon named "access alarm".
  static access_alarm = IconData.new(0xe190, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">access_alarms</i> &#x2014; material icon named "access alarms".
  static access_alarms = IconData.new(0xe191, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">access_time</i> &#x2014; material icon named "access time".
  static access_time = IconData.new(0xe192, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">accessibility</i> &#x2014; material icon named "accessibility".
  static accessibility = IconData.new(0xe84e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">accessibility_new</i> &#x2014; material icon named "accessibility new".
  static accessibility_new = IconData.new(0xe92c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">accessible</i> &#x2014; material icon named "accessible".
  static accessible = IconData.new(0xe914, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">accessible_forward</i> &#x2014; material icon named "accessible forward".
  static accessible_forward = IconData.new(0xe934, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">account_balance</i> &#x2014; material icon named "account balance".
  static account_balance = IconData.new(0xe84f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">account_balance_wallet</i> &#x2014; material icon named "account balance wallet".
  static account_balance_wallet = IconData.new(0xe850, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">account_box</i> &#x2014; material icon named "account box".
  static account_box = IconData.new(0xe851, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">account_circle</i> &#x2014; material icon named "account circle".
  static account_circle = IconData.new(0xe853, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">adb</i> &#x2014; material icon named "adb".
  static adb = IconData.new(0xe60e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add</i> &#x2014; material icon named "add".
  static add = IconData.new(0xe145, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_a_photo</i> &#x2014; material icon named "add a photo".
  static add_a_photo = IconData.new(0xe439, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_alarm</i> &#x2014; material icon named "add alarm".
  static add_alarm = IconData.new(0xe193, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_alert</i> &#x2014; material icon named "add alert".
  static add_alert = IconData.new(0xe003, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_box</i> &#x2014; material icon named "add box".
  static add_box = IconData.new(0xe146, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_call</i> &#x2014; material icon named "add call".
  static add_call = IconData.new(0xe0e8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_circle</i> &#x2014; material icon named "add circle".
  static add_circle = IconData.new(0xe147, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_circle_outline</i> &#x2014; material icon named "add circle outline".
  static add_circle_outline = IconData.new(0xe148, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_comment</i> &#x2014; material icon named "add comment".
  static add_comment = IconData.new(0xe266, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_location</i> &#x2014; material icon named "add location".
  static add_location = IconData.new(0xe567, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_photo_alternate</i> &#x2014; material icon named "add photo alternate".
  static add_photo_alternate = IconData.new(0xe43e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_shopping_cart</i> &#x2014; material icon named "add shopping cart".
  static add_shopping_cart = IconData.new(0xe854, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_to_home_screen</i> &#x2014; material icon named "add to home screen".
  static add_to_home_screen = IconData.new(0xe1fe, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_to_photos</i> &#x2014; material icon named "add to photos".
  static add_to_photos = IconData.new(0xe39d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">add_to_queue</i> &#x2014; material icon named "add to queue".
  static add_to_queue = IconData.new(0xe05c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">adjust</i> &#x2014; material icon named "adjust".
  static adjust = IconData.new(0xe39e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_flat</i> &#x2014; material icon named "airline seat flat".
  static airline_seat_flat = IconData.new(0xe630, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_flat_angled</i> &#x2014; material icon named "airline seat flat angled".
  static airline_seat_flat_angled = IconData.new(0xe631, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_individual_suite</i> &#x2014; material icon named "airline seat individual suite".
  static airline_seat_individual_suite = IconData.new(0xe632, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_legroom_extra</i> &#x2014; material icon named "airline seat legroom extra".
  static airline_seat_legroom_extra = IconData.new(0xe633, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_legroom_normal</i> &#x2014; material icon named "airline seat legroom normal".
  static airline_seat_legroom_normal = IconData.new(0xe634, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_legroom_reduced</i> &#x2014; material icon named "airline seat legroom reduced".
  static airline_seat_legroom_reduced = IconData.new(0xe635, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_recline_extra</i> &#x2014; material icon named "airline seat recline extra".
  static airline_seat_recline_extra = IconData.new(0xe636, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airline_seat_recline_normal</i> &#x2014; material icon named "airline seat recline normal".
  static airline_seat_recline_normal = IconData.new(0xe637, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airplanemode_active</i> &#x2014; material icon named "airplanemode active".
  static airplanemode_active = IconData.new(0xe195, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airplanemode_inactive</i> &#x2014; material icon named "airplanemode inactive".
  static airplanemode_inactive = IconData.new(0xe194, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airplay</i> &#x2014; material icon named "airplay".
  static airplay = IconData.new(0xe055, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">airport_shuttle</i> &#x2014; material icon named "airport shuttle".
  static airport_shuttle = IconData.new(0xeb3c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">alarm</i> &#x2014; material icon named "alarm".
  static alarm = IconData.new(0xe855, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">alarm_add</i> &#x2014; material icon named "alarm add".
  static alarm_add = IconData.new(0xe856, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">alarm_off</i> &#x2014; material icon named "alarm off".
  static alarm_off = IconData.new(0xe857, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">alarm_on</i> &#x2014; material icon named "alarm on".
  static alarm_on = IconData.new(0xe858, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">album</i> &#x2014; material icon named "album".
  static album = IconData.new(0xe019, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">all_inclusive</i> &#x2014; material icon named "all inclusive".
  static all_inclusive = IconData.new(0xeb3d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">all_out</i> &#x2014; material icon named "all out".
  static all_out = IconData.new(0xe90b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">alternate_email</i> &#x2014; material icon named "alternate email".
  static alternate_email = IconData.new(0xe0e6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">android</i> &#x2014; material icon named "android".
  static android = IconData.new(0xe859, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">announcement</i> &#x2014; material icon named "announcement".
  static announcement = IconData.new(0xe85a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">apps</i> &#x2014; material icon named "apps".
  static apps = IconData.new(0xe5c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">archive</i> &#x2014; material icon named "archive".
  static archive = IconData.new(0xe149, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">arrow_back</i> &#x2014; material icon named "arrow back".
  static arrow_back = IconData.new(0xe5c4, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_back_ios</i> &#x2014; material icon named "arrow back ios".
  static arrow_back_ios = IconData.new(0xe5e0, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_downward</i> &#x2014; material icon named "arrow downward".
  static arrow_downward = IconData.new(0xe5db, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">arrow_drop_down</i> &#x2014; material icon named "arrow drop down".
  static arrow_drop_down = IconData.new(0xe5c5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">arrow_drop_down_circle</i> &#x2014; material icon named "arrow drop down circle".
  static arrow_drop_down_circle = IconData.new(0xe5c6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">arrow_drop_up</i> &#x2014; material icon named "arrow drop up".
  static arrow_drop_up = IconData.new(0xe5c7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">arrow_forward</i> &#x2014; material icon named "arrow forward".
  static arrow_forward = IconData.new(0xe5c8, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_forward_ios</i> &#x2014; material icon named "arrow forward ios".
  static arrow_forward_ios = IconData.new(0xe5e1, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_left</i> &#x2014; material icon named "arrow left".
  static arrow_left = IconData.new(0xe5de, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_right</i> &#x2014; material icon named "arrow right".
  static arrow_right = IconData.new(0xe5df, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">arrow_upward</i> &#x2014; material icon named "arrow upward".
  static arrow_upward = IconData.new(0xe5d8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">art_track</i> &#x2014; material icon named "art track".
  static art_track = IconData.new(0xe060, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">aspect_ratio</i> &#x2014; material icon named "aspect ratio".
  static aspect_ratio = IconData.new(0xe85b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assessment</i> &#x2014; material icon named "assessment".
  static assessment = IconData.new(0xe85c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assignment</i> &#x2014; material icon named "assignment".
  static assignment = IconData.new(0xe85d, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">assignment_ind</i> &#x2014; material icon named "assignment ind".
  static assignment_ind = IconData.new(0xe85e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assignment_late</i> &#x2014; material icon named "assignment late".
  static assignment_late = IconData.new(0xe85f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assignment_return</i> &#x2014; material icon named "assignment return".
  static assignment_return = IconData.new(0xe860, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">assignment_returned</i> &#x2014; material icon named "assignment returned".
  static assignment_returned = IconData.new(0xe861, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assignment_turned_in</i> &#x2014; material icon named "assignment turned in".
  static assignment_turned_in = IconData.new(0xe862, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assistant</i> &#x2014; material icon named "assistant".
  static assistant = IconData.new(0xe39f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">assistant_photo</i> &#x2014; material icon named "assistant photo".
  static assistant_photo = IconData.new(0xe3a0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">atm</i> &#x2014; material icon named "atm".
  static atm = IconData.new(0xe573, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">attach_file</i> &#x2014; material icon named "attach file".
  static attach_file = IconData.new(0xe226, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">attach_money</i> &#x2014; material icon named "attach money".
  static attach_money = IconData.new(0xe227, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">attachment</i> &#x2014; material icon named "attachment".
  static attachment = IconData.new(0xe2bc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">audiotrack</i> &#x2014; material icon named "audiotrack".
  static audiotrack = IconData.new(0xe3a1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">autorenew</i> &#x2014; material icon named "autorenew".
  static autorenew = IconData.new(0xe863, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">av_timer</i> &#x2014; material icon named "av timer".
  static av_timer = IconData.new(0xe01b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">backspace</i> &#x2014; material icon named "backspace".
  static backspace = IconData.new(0xe14a, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">backup</i> &#x2014; material icon named "backup".
  static backup = IconData.new(0xe864, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">battery_alert</i> &#x2014; material icon named "battery alert".
  static battery_alert = IconData.new(0xe19c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">battery_charging_full</i> &#x2014; material icon named "battery charging full".
  static battery_charging_full = IconData.new(0xe1a3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">battery_full</i> &#x2014; material icon named "battery full".
  static battery_full = IconData.new(0xe1a4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">battery_std</i> &#x2014; material icon named "battery std".
  static battery_std = IconData.new(0xe1a5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">battery_unknown</i> &#x2014; material icon named "battery unknown".
  static battery_unknown = IconData.new(0xe1a6, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">beach_access</i> &#x2014; material icon named "beach access".
  static beach_access = IconData.new(0xeb3e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">beenhere</i> &#x2014; material icon named "beenhere".
  static beenhere = IconData.new(0xe52d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">block</i> &#x2014; material icon named "block".
  static block = IconData.new(0xe14b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bluetooth</i> &#x2014; material icon named "bluetooth".
  static bluetooth = IconData.new(0xe1a7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bluetooth_audio</i> &#x2014; material icon named "bluetooth audio".
  static bluetooth_audio = IconData.new(0xe60f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bluetooth_connected</i> &#x2014; material icon named "bluetooth connected".
  static bluetooth_connected = IconData.new(0xe1a8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bluetooth_disabled</i> &#x2014; material icon named "bluetooth disabled".
  static bluetooth_disabled = IconData.new(0xe1a9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bluetooth_searching</i> &#x2014; material icon named "bluetooth searching".
  static bluetooth_searching = IconData.new(0xe1aa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">blur_circular</i> &#x2014; material icon named "blur circular".
  static blur_circular = IconData.new(0xe3a2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">blur_linear</i> &#x2014; material icon named "blur linear".
  static blur_linear = IconData.new(0xe3a3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">blur_off</i> &#x2014; material icon named "blur off".
  static blur_off = IconData.new(0xe3a4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">blur_on</i> &#x2014; material icon named "blur on".
  static blur_on = IconData.new(0xe3a5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">book</i> &#x2014; material icon named "book".
  static book = IconData.new(0xe865, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bookmark</i> &#x2014; material icon named "bookmark".
  static bookmark = IconData.new(0xe866, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bookmark_border</i> &#x2014; material icon named "bookmark border".
  static bookmark_border = IconData.new(0xe867, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_all</i> &#x2014; material icon named "border all".
  static border_all = IconData.new(0xe228, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_bottom</i> &#x2014; material icon named "border bottom".
  static border_bottom = IconData.new(0xe229, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_clear</i> &#x2014; material icon named "border clear".
  static border_clear = IconData.new(0xe22a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_color</i> &#x2014; material icon named "border color".
  static border_color = IconData.new(0xe22b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_horizontal</i> &#x2014; material icon named "border horizontal".
  static border_horizontal = IconData.new(0xe22c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_inner</i> &#x2014; material icon named "border inner".
  static border_inner = IconData.new(0xe22d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_left</i> &#x2014; material icon named "border left".
  static border_left = IconData.new(0xe22e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_outer</i> &#x2014; material icon named "border outer".
  static border_outer = IconData.new(0xe22f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_right</i> &#x2014; material icon named "border right".
  static border_right = IconData.new(0xe230, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_style</i> &#x2014; material icon named "border style".
  static border_style = IconData.new(0xe231, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_top</i> &#x2014; material icon named "border top".
  static border_top = IconData.new(0xe232, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">border_vertical</i> &#x2014; material icon named "border vertical".
  static border_vertical = IconData.new(0xe233, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">branding_watermark</i> &#x2014; material icon named "branding watermark".
  static branding_watermark = IconData.new(0xe06b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_1</i> &#x2014; material icon named "brightness 1".
  static brightness_1 = IconData.new(0xe3a6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_2</i> &#x2014; material icon named "brightness 2".
  static brightness_2 = IconData.new(0xe3a7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_3</i> &#x2014; material icon named "brightness 3".
  static brightness_3 = IconData.new(0xe3a8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_4</i> &#x2014; material icon named "brightness 4".
  static brightness_4 = IconData.new(0xe3a9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_5</i> &#x2014; material icon named "brightness 5".
  static brightness_5 = IconData.new(0xe3aa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_6</i> &#x2014; material icon named "brightness 6".
  static brightness_6 = IconData.new(0xe3ab, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_7</i> &#x2014; material icon named "brightness 7".
  static brightness_7 = IconData.new(0xe3ac, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_auto</i> &#x2014; material icon named "brightness auto".
  static brightness_auto = IconData.new(0xe1ab, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_high</i> &#x2014; material icon named "brightness high".
  static brightness_high = IconData.new(0xe1ac, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_low</i> &#x2014; material icon named "brightness low".
  static brightness_low = IconData.new(0xe1ad, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brightness_medium</i> &#x2014; material icon named "brightness medium".
  static brightness_medium = IconData.new(0xe1ae, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">broken_image</i> &#x2014; material icon named "broken image".
  static broken_image = IconData.new(0xe3ad, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">brush</i> &#x2014; material icon named "brush".
  static brush = IconData.new(0xe3ae, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bubble_chart</i> &#x2014; material icon named "bubble chart".
  static bubble_chart = IconData.new(0xe6dd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">bug_report</i> &#x2014; material icon named "bug report".
  static bug_report = IconData.new(0xe868, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">build</i> &#x2014; material icon named "build".
  static build = IconData.new(0xe869, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">burst_mode</i> &#x2014; material icon named "burst mode".
  static burst_mode = IconData.new(0xe43c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">business</i> &#x2014; material icon named "business".
  static business = IconData.new(0xe0af, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">business_center</i> &#x2014; material icon named "business center".
  static business_center = IconData.new(0xeb3f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cached</i> &#x2014; material icon named "cached".
  static cached = IconData.new(0xe86a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cake</i> &#x2014; material icon named "cake".
  static cake = IconData.new(0xe7e9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">calendar_today</i> &#x2014; material icon named "calendar today".
  static calendar_today = IconData.new(0xe935, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">calendar_view_day</i> &#x2014; material icon named "calendar view day".
  static calendar_view_day = IconData.new(0xe936, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">call</i> &#x2014; material icon named "call".
  static call = IconData.new(0xe0b0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">call_end</i> &#x2014; material icon named "call end".
  static call_end = IconData.new(0xe0b1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">call_made</i> &#x2014; material icon named "call made".
  static call_made = IconData.new(0xe0b2, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_merge</i> &#x2014; material icon named "call merge".
  static call_merge = IconData.new(0xe0b3, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_missed</i> &#x2014; material icon named "call missed".
  static call_missed = IconData.new(0xe0b4, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_missed_outgoing</i> &#x2014; material icon named "call missed outgoing".
  static call_missed_outgoing = IconData.new(0xe0e4, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_received</i> &#x2014; material icon named "call received".
  static call_received = IconData.new(0xe0b5, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_split</i> &#x2014; material icon named "call split".
  static call_split = IconData.new(0xe0b6, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">call_to_action</i> &#x2014; material icon named "call to action".
  static call_to_action = IconData.new(0xe06c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera</i> &#x2014; material icon named "camera".
  static camera = IconData.new(0xe3af, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera_alt</i> &#x2014; material icon named "camera alt".
  static camera_alt = IconData.new(0xe3b0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera_enhance</i> &#x2014; material icon named "camera enhance".
  static camera_enhance = IconData.new(0xe8fc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera_front</i> &#x2014; material icon named "camera front".
  static camera_front = IconData.new(0xe3b1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera_rear</i> &#x2014; material icon named "camera rear".
  static camera_rear = IconData.new(0xe3b2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">camera_roll</i> &#x2014; material icon named "camera roll".
  static camera_roll = IconData.new(0xe3b3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cancel</i> &#x2014; material icon named "cancel".
  static cancel = IconData.new(0xe5c9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">card_giftcard</i> &#x2014; material icon named "card giftcard".
  static card_giftcard = IconData.new(0xe8f6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">card_membership</i> &#x2014; material icon named "card membership".
  static card_membership = IconData.new(0xe8f7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">card_travel</i> &#x2014; material icon named "card travel".
  static card_travel = IconData.new(0xe8f8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">casino</i> &#x2014; material icon named "casino".
  static casino = IconData.new(0xeb40, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cast</i> &#x2014; material icon named "cast".
  static cast = IconData.new(0xe307, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cast_connected</i> &#x2014; material icon named "cast connected".
  static cast_connected = IconData.new(0xe308, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">category</i> &#x2014; material icon named "category".
  static category = IconData.new(0xe574, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">center_focus_strong</i> &#x2014; material icon named "center focus strong".
  static center_focus_strong = IconData.new(0xe3b4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">center_focus_weak</i> &#x2014; material icon named "center focus weak".
  static center_focus_weak = IconData.new(0xe3b5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">change_history</i> &#x2014; material icon named "change history".
  static change_history = IconData.new(0xe86b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">chat</i> &#x2014; material icon named "chat".
  static chat = IconData.new(0xe0b7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">chat_bubble</i> &#x2014; material icon named "chat bubble".
  static chat_bubble = IconData.new(0xe0ca, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">chat_bubble_outline</i> &#x2014; material icon named "chat bubble outline".
  static chat_bubble_outline = IconData.new(0xe0cb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">check</i> &#x2014; material icon named "check".
  static check = IconData.new(0xe5ca, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">check_box</i> &#x2014; material icon named "check box".
  static check_box = IconData.new(0xe834, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">check_box_outline_blank</i> &#x2014; material icon named "check box outline blank".
  static check_box_outline_blank = IconData.new(0xe835, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">check_circle</i> &#x2014; material icon named "check circle".
  static check_circle = IconData.new(0xe86c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">check_circle_outline</i> &#x2014; material icon named "check circle outline".
  static check_circle_outline = IconData.new(0xe92d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">chevron_left</i> &#x2014; material icon named "chevron left".
  static chevron_left = IconData.new(0xe5cb, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">chevron_right</i> &#x2014; material icon named "chevron right".
  static chevron_right = IconData.new(0xe5cc, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">child_care</i> &#x2014; material icon named "child care".
  static child_care = IconData.new(0xeb41, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">child_friendly</i> &#x2014; material icon named "child friendly".
  static child_friendly = IconData.new(0xeb42, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">chrome_reader_mode</i> &#x2014; material icon named "chrome reader mode".
  static chrome_reader_mode = IconData.new(0xe86d, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">class</i> &#x2014; material icon named "class".
  static class_ = IconData.new(0xe86e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">clear</i> &#x2014; material icon named "clear".
  static clear = IconData.new(0xe14c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">clear_all</i> &#x2014; material icon named "clear all".
  static clear_all = IconData.new(0xe0b8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">close</i> &#x2014; material icon named "close".
  static close = IconData.new(0xe5cd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">closed_caption</i> &#x2014; material icon named "closed caption".
  static closed_caption = IconData.new(0xe01c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud</i> &#x2014; material icon named "cloud".
  static cloud = IconData.new(0xe2bd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_circle</i> &#x2014; material icon named "cloud circle".
  static cloud_circle = IconData.new(0xe2be, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_done</i> &#x2014; material icon named "cloud done".
  static cloud_done = IconData.new(0xe2bf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_download</i> &#x2014; material icon named "cloud download".
  static cloud_download = IconData.new(0xe2c0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_off</i> &#x2014; material icon named "cloud off".
  static cloud_off = IconData.new(0xe2c1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_queue</i> &#x2014; material icon named "cloud queue".
  static cloud_queue = IconData.new(0xe2c2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">cloud_upload</i> &#x2014; material icon named "cloud upload".
  static cloud_upload = IconData.new(0xe2c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">code</i> &#x2014; material icon named "code".
  static code = IconData.new(0xe86f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">collections</i> &#x2014; material icon named "collections".
  static collections = IconData.new(0xe3b6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">collections_bookmark</i> &#x2014; material icon named "collections bookmark".
  static collections_bookmark = IconData.new(0xe431, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">color_lens</i> &#x2014; material icon named "color lens".
  static color_lens = IconData.new(0xe3b7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">colorize</i> &#x2014; material icon named "colorize".
  static colorize = IconData.new(0xe3b8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">comment</i> &#x2014; material icon named "comment".
  static comment = IconData.new(0xe0b9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">compare</i> &#x2014; material icon named "compare".
  static compare = IconData.new(0xe3b9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">compare_arrows</i> &#x2014; material icon named "compare arrows".
  static compare_arrows = IconData.new(0xe915, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">computer</i> &#x2014; material icon named "computer".
  static computer = IconData.new(0xe30a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">confirmation_number</i> &#x2014; material icon named "confirmation number".
  static confirmation_number = IconData.new(0xe638, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">contact_mail</i> &#x2014; material icon named "contact mail".
  static contact_mail = IconData.new(0xe0d0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">contact_phone</i> &#x2014; material icon named "contact phone".
  static contact_phone = IconData.new(0xe0cf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">contacts</i> &#x2014; material icon named "contacts".
  static contacts = IconData.new(0xe0ba, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">content_copy</i> &#x2014; material icon named "content copy".
  static content_copy = IconData.new(0xe14d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">content_cut</i> &#x2014; material icon named "content cut".
  static content_cut = IconData.new(0xe14e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">content_paste</i> &#x2014; material icon named "content paste".
  static content_paste = IconData.new(0xe14f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">control_point</i> &#x2014; material icon named "control point".
  static control_point = IconData.new(0xe3ba, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">control_point_duplicate</i> &#x2014; material icon named "control point duplicate".
  static control_point_duplicate = IconData.new(0xe3bb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">copyright</i> &#x2014; material icon named "copyright".
  static copyright = IconData.new(0xe90c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">create</i> &#x2014; material icon named "create".
  static create = IconData.new(0xe150, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">create_new_folder</i> &#x2014; material icon named "create new folder".
  static create_new_folder = IconData.new(0xe2cc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">credit_card</i> &#x2014; material icon named "credit card".
  static credit_card = IconData.new(0xe870, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop</i> &#x2014; material icon named "crop".
  static crop = IconData.new(0xe3be, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_16_9</i> &#x2014; material icon named "crop 16 9".
  static crop_16_9 = IconData.new(0xe3bc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_3_2</i> &#x2014; material icon named "crop 3 2".
  static crop_3_2 = IconData.new(0xe3bd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_5_4</i> &#x2014; material icon named "crop 5 4".
  static crop_5_4 = IconData.new(0xe3bf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_7_5</i> &#x2014; material icon named "crop 7 5".
  static crop_7_5 = IconData.new(0xe3c0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_din</i> &#x2014; material icon named "crop din".
  static crop_din = IconData.new(0xe3c1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_free</i> &#x2014; material icon named "crop free".
  static crop_free = IconData.new(0xe3c2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_landscape</i> &#x2014; material icon named "crop landscape".
  static crop_landscape = IconData.new(0xe3c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_original</i> &#x2014; material icon named "crop original".
  static crop_original = IconData.new(0xe3c4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_portrait</i> &#x2014; material icon named "crop portrait".
  static crop_portrait = IconData.new(0xe3c5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_rotate</i> &#x2014; material icon named "crop rotate".
  static crop_rotate = IconData.new(0xe437, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">crop_square</i> &#x2014; material icon named "crop square".
  static crop_square = IconData.new(0xe3c6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dashboard</i> &#x2014; material icon named "dashboard".
  static dashboard = IconData.new(0xe871, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">data_usage</i> &#x2014; material icon named "data usage".
  static data_usage = IconData.new(0xe1af, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">date_range</i> &#x2014; material icon named "date range".
  static date_range = IconData.new(0xe916, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dehaze</i> &#x2014; material icon named "dehaze".
  static dehaze = IconData.new(0xe3c7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">delete</i> &#x2014; material icon named "delete".
  static delete = IconData.new(0xe872, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">delete_forever</i> &#x2014; material icon named "delete forever".
  static delete_forever = IconData.new(0xe92b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">delete_outline</i> &#x2014; material icon named "delete outline".
  static delete_outline = IconData.new(0xe92e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">delete_sweep</i> &#x2014; material icon named "delete sweep".
  static delete_sweep = IconData.new(0xe16c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">departure_board</i> &#x2014; material icon named "departure board".
  static departure_board = IconData.new(0xe576, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">description</i> &#x2014; material icon named "description".
  static description = IconData.new(0xe873, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">desktop_mac</i> &#x2014; material icon named "desktop mac".
  static desktop_mac = IconData.new(0xe30b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">desktop_windows</i> &#x2014; material icon named "desktop windows".
  static desktop_windows = IconData.new(0xe30c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">details</i> &#x2014; material icon named "details".
  static details = IconData.new(0xe3c8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">developer_board</i> &#x2014; material icon named "developer board".
  static developer_board = IconData.new(0xe30d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">developer_mode</i> &#x2014; material icon named "developer mode".
  static developer_mode = IconData.new(0xe1b0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">device_hub</i> &#x2014; material icon named "device hub".
  static device_hub = IconData.new(0xe335, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">device_unknown</i> &#x2014; material icon named "device unknown".
  static device_unknown = IconData.new(0xe339, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">devices</i> &#x2014; material icon named "devices".
  static devices = IconData.new(0xe1b1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">devices_other</i> &#x2014; material icon named "devices other".
  static devices_other = IconData.new(0xe337, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dialer_sip</i> &#x2014; material icon named "dialer sip".
  static dialer_sip = IconData.new(0xe0bb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dialpad</i> &#x2014; material icon named "dialpad".
  static dialpad = IconData.new(0xe0bc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions</i> &#x2014; material icon named "directions".
  static directions = IconData.new(0xe52e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_bike</i> &#x2014; material icon named "directions bike".
  static directions_bike = IconData.new(0xe52f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_boat</i> &#x2014; material icon named "directions boat".
  static directions_boat = IconData.new(0xe532, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_bus</i> &#x2014; material icon named "directions bus".
  static directions_bus = IconData.new(0xe530, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_car</i> &#x2014; material icon named "directions car".
  static directions_car = IconData.new(0xe531, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_railway</i> &#x2014; material icon named "directions railway".
  static directions_railway = IconData.new(0xe534, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_run</i> &#x2014; material icon named "directions run".
  static directions_run = IconData.new(0xe566, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_subway</i> &#x2014; material icon named "directions subway".
  static directions_subway = IconData.new(0xe533, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_transit</i> &#x2014; material icon named "directions transit".
  static directions_transit = IconData.new(0xe535, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">directions_walk</i> &#x2014; material icon named "directions walk".
  static directions_walk = IconData.new(0xe536, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">disc_full</i> &#x2014; material icon named "disc full".
  static disc_full = IconData.new(0xe610, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dns</i> &#x2014; material icon named "dns".
  static dns = IconData.new(0xe875, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">do_not_disturb</i> &#x2014; material icon named "do not disturb".
  static do_not_disturb = IconData.new(0xe612, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">do_not_disturb_alt</i> &#x2014; material icon named "do not disturb alt".
  static do_not_disturb_alt = IconData.new(0xe611, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">do_not_disturb_off</i> &#x2014; material icon named "do not disturb off".
  static do_not_disturb_off = IconData.new(0xe643, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">do_not_disturb_on</i> &#x2014; material icon named "do not disturb on".
  static do_not_disturb_on = IconData.new(0xe644, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dock</i> &#x2014; material icon named "dock".
  static dock = IconData.new(0xe30e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">domain</i> &#x2014; material icon named "domain".
  static domain = IconData.new(0xe7ee, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">done</i> &#x2014; material icon named "done".
  static done = IconData.new(0xe876, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">done_all</i> &#x2014; material icon named "done all".
  static done_all = IconData.new(0xe877, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">done_outline</i> &#x2014; material icon named "done outline".
  static done_outline = IconData.new(0xe92f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">donut_large</i> &#x2014; material icon named "donut large".
  static donut_large = IconData.new(0xe917, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">donut_small</i> &#x2014; material icon named "donut small".
  static donut_small = IconData.new(0xe918, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">drafts</i> &#x2014; material icon named "drafts".
  static drafts = IconData.new(0xe151, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">drag_handle</i> &#x2014; material icon named "drag handle".
  static drag_handle = IconData.new(0xe25d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">drive_eta</i> &#x2014; material icon named "drive eta".
  static drive_eta = IconData.new(0xe613, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">dvr</i> &#x2014; material icon named "dvr".
  static dvr = IconData.new(0xe1b2, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">edit</i> &#x2014; material icon named "edit".
  static edit = IconData.new(0xe3c9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">edit_attributes</i> &#x2014; material icon named "edit attributes".
  static edit_attributes = IconData.new(0xe578, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">edit_location</i> &#x2014; material icon named "edit location".
  static edit_location = IconData.new(0xe568, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">eject</i> &#x2014; material icon named "eject".
  static eject = IconData.new(0xe8fb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">email</i> &#x2014; material icon named "email".
  static email = IconData.new(0xe0be, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">enhanced_encryption</i> &#x2014; material icon named "enhanced encryption".
  static enhanced_encryption = IconData.new(0xe63f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">equalizer</i> &#x2014; material icon named "equalizer".
  static equalizer = IconData.new(0xe01d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">error</i> &#x2014; material icon named "error".
  static error = IconData.new(0xe000, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">error_outline</i> &#x2014; material icon named "error outline".
  static error_outline = IconData.new(0xe001, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">euro_symbol</i> &#x2014; material icon named "euro symbol".
  static euro_symbol = IconData.new(0xe926, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">ev_station</i> &#x2014; material icon named "ev station".
  static ev_station = IconData.new(0xe56d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">event</i> &#x2014; material icon named "event".
  static event = IconData.new(0xe878, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">event_available</i> &#x2014; material icon named "event available".
  static event_available = IconData.new(0xe614, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">event_busy</i> &#x2014; material icon named "event busy".
  static event_busy = IconData.new(0xe615, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">event_note</i> &#x2014; material icon named "event note".
  static event_note = IconData.new(0xe616, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">event_seat</i> &#x2014; material icon named "event seat".
  static event_seat = IconData.new(0xe903, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exit_to_app</i> &#x2014; material icon named "exit to app".
  static exit_to_app = IconData.new(0xe879, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">expand_less</i> &#x2014; material icon named "expand less".
  static expand_less = IconData.new(0xe5ce, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">expand_more</i> &#x2014; material icon named "expand more".
  static expand_more = IconData.new(0xe5cf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">explicit</i> &#x2014; material icon named "explicit".
  static explicit = IconData.new(0xe01e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">explore</i> &#x2014; material icon named "explore".
  static explore = IconData.new(0xe87a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure</i> &#x2014; material icon named "exposure".
  static exposure = IconData.new(0xe3ca, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure_neg_1</i> &#x2014; material icon named "exposure neg 1".
  static exposure_neg_1 = IconData.new(0xe3cb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure_neg_2</i> &#x2014; material icon named "exposure neg 2".
  static exposure_neg_2 = IconData.new(0xe3cc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure_plus_1</i> &#x2014; material icon named "exposure plus 1".
  static exposure_plus_1 = IconData.new(0xe3cd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure_plus_2</i> &#x2014; material icon named "exposure plus 2".
  static exposure_plus_2 = IconData.new(0xe3ce, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">exposure_zero</i> &#x2014; material icon named "exposure zero".
  static exposure_zero = IconData.new(0xe3cf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">extension</i> &#x2014; material icon named "extension".
  static extension = IconData.new(0xe87b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">face</i> &#x2014; material icon named "face".
  static face = IconData.new(0xe87c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fast_forward</i> &#x2014; material icon named "fast forward".
  static fast_forward = IconData.new(0xe01f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fast_rewind</i> &#x2014; material icon named "fast rewind".
  static fast_rewind = IconData.new(0xe020, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fastfood</i> &#x2014; material icon named "fastfood".
  static fastfood = IconData.new(0xe57a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">favorite</i> &#x2014; material icon named "favorite".
  static favorite = IconData.new(0xe87d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">favorite_border</i> &#x2014; material icon named "favorite border".
  static favorite_border = IconData.new(0xe87e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">featured_play_list</i> &#x2014; material icon named "featured play list".
  static featured_play_list = IconData.new(0xe06d, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">featured_video</i> &#x2014; material icon named "featured video".
  static featured_video = IconData.new(0xe06e, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">feedback</i> &#x2014; material icon named "feedback".
  static feedback = IconData.new(0xe87f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fiber_dvr</i> &#x2014; material icon named "fiber dvr".
  static fiber_dvr = IconData.new(0xe05d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fiber_manual_record</i> &#x2014; material icon named "fiber manual record".
  static fiber_manual_record = IconData.new(0xe061, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fiber_new</i> &#x2014; material icon named "fiber new".
  static fiber_new = IconData.new(0xe05e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fiber_pin</i> &#x2014; material icon named "fiber pin".
  static fiber_pin = IconData.new(0xe06a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fiber_smart_record</i> &#x2014; material icon named "fiber smart record".
  static fiber_smart_record = IconData.new(0xe062, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">file_download</i> &#x2014; material icon named "file download".
  static file_download = IconData.new(0xe2c4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">file_upload</i> &#x2014; material icon named "file upload".
  static file_upload = IconData.new(0xe2c6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter</i> &#x2014; material icon named "filter".
  static filter = IconData.new(0xe3d3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_1</i> &#x2014; material icon named "filter 1".
  static filter_1 = IconData.new(0xe3d0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_2</i> &#x2014; material icon named "filter 2".
  static filter_2 = IconData.new(0xe3d1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_3</i> &#x2014; material icon named "filter 3".
  static filter_3 = IconData.new(0xe3d2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_4</i> &#x2014; material icon named "filter 4".
  static filter_4 = IconData.new(0xe3d4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_5</i> &#x2014; material icon named "filter 5".
  static filter_5 = IconData.new(0xe3d5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_6</i> &#x2014; material icon named "filter 6".
  static filter_6 = IconData.new(0xe3d6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_7</i> &#x2014; material icon named "filter 7".
  static filter_7 = IconData.new(0xe3d7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_8</i> &#x2014; material icon named "filter 8".
  static filter_8 = IconData.new(0xe3d8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_9</i> &#x2014; material icon named "filter 9".
  static filter_9 = IconData.new(0xe3d9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_9_plus</i> &#x2014; material icon named "filter 9 plus".
  static filter_9_plus = IconData.new(0xe3da, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_b_and_w</i> &#x2014; material icon named "filter b and w".
  static filter_b_and_w = IconData.new(0xe3db, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_center_focus</i> &#x2014; material icon named "filter center focus".
  static filter_center_focus = IconData.new(0xe3dc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_drama</i> &#x2014; material icon named "filter drama".
  static filter_drama = IconData.new(0xe3dd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_frames</i> &#x2014; material icon named "filter frames".
  static filter_frames = IconData.new(0xe3de, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_hdr</i> &#x2014; material icon named "filter hdr".
  static filter_hdr = IconData.new(0xe3df, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_list</i> &#x2014; material icon named "filter list".
  static filter_list = IconData.new(0xe152, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_none</i> &#x2014; material icon named "filter none".
  static filter_none = IconData.new(0xe3e0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_tilt_shift</i> &#x2014; material icon named "filter tilt shift".
  static filter_tilt_shift = IconData.new(0xe3e2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">filter_vintage</i> &#x2014; material icon named "filter vintage".
  static filter_vintage = IconData.new(0xe3e3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">find_in_page</i> &#x2014; material icon named "find in page".
  static find_in_page = IconData.new(0xe880, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">find_replace</i> &#x2014; material icon named "find replace".
  static find_replace = IconData.new(0xe881, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fingerprint</i> &#x2014; material icon named "fingerprint".
  static fingerprint = IconData.new(0xe90d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">first_page</i> &#x2014; material icon named "first page".
  static first_page = IconData.new(0xe5dc, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">fitness_center</i> &#x2014; material icon named "fitness center".
  static fitness_center = IconData.new(0xeb43, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flag</i> &#x2014; material icon named "flag".
  static flag = IconData.new(0xe153, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flare</i> &#x2014; material icon named "flare".
  static flare = IconData.new(0xe3e4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flash_auto</i> &#x2014; material icon named "flash auto".
  static flash_auto = IconData.new(0xe3e5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flash_off</i> &#x2014; material icon named "flash off".
  static flash_off = IconData.new(0xe3e6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flash_on</i> &#x2014; material icon named "flash on".
  static flash_on = IconData.new(0xe3e7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flight</i> &#x2014; material icon named "flight".
  static flight = IconData.new(0xe539, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flight_land</i> &#x2014; material icon named "flight land".
  static flight_land = IconData.new(0xe904, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">flight_takeoff</i> &#x2014; material icon named "flight takeoff".
  static flight_takeoff = IconData.new(0xe905, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">flip</i> &#x2014; material icon named "flip".
  static flip = IconData.new(0xe3e8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flip_to_back</i> &#x2014; material icon named "flip to back".
  static flip_to_back = IconData.new(0xe882, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">flip_to_front</i> &#x2014; material icon named "flip to front".
  static flip_to_front = IconData.new(0xe883, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">folder</i> &#x2014; material icon named "folder".
  static folder = IconData.new(0xe2c7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">folder_open</i> &#x2014; material icon named "folder open".
  static folder_open = IconData.new(0xe2c8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">folder_shared</i> &#x2014; material icon named "folder shared".
  static folder_shared = IconData.new(0xe2c9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">folder_special</i> &#x2014; material icon named "folder special".
  static folder_special = IconData.new(0xe617, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">font_download</i> &#x2014; material icon named "font download".
  static font_download = IconData.new(0xe167, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_align_center</i> &#x2014; material icon named "format align center".
  static format_align_center = IconData.new(0xe234, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_align_justify</i> &#x2014; material icon named "format align justify".
  static format_align_justify = IconData.new(0xe235, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_align_left</i> &#x2014; material icon named "format align left".
  static format_align_left = IconData.new(0xe236, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_align_right</i> &#x2014; material icon named "format align right".
  static format_align_right = IconData.new(0xe237, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_bold</i> &#x2014; material icon named "format bold".
  static format_bold = IconData.new(0xe238, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_clear</i> &#x2014; material icon named "format clear".
  static format_clear = IconData.new(0xe239, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_color_fill</i> &#x2014; material icon named "format color fill".
  static format_color_fill = IconData.new(0xe23a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_color_reset</i> &#x2014; material icon named "format color reset".
  static format_color_reset = IconData.new(0xe23b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_color_text</i> &#x2014; material icon named "format color text".
  static format_color_text = IconData.new(0xe23c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_indent_decrease</i> &#x2014; material icon named "format indent decrease".
  static format_indent_decrease = IconData.new(0xe23d, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">format_indent_increase</i> &#x2014; material icon named "format indent increase".
  static format_indent_increase = IconData.new(0xe23e, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">format_italic</i> &#x2014; material icon named "format italic".
  static format_italic = IconData.new(0xe23f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_line_spacing</i> &#x2014; material icon named "format line spacing".
  static format_line_spacing = IconData.new(0xe240, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_list_bulleted</i> &#x2014; material icon named "format list bulleted".
  static format_list_bulleted = IconData.new(0xe241, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">format_list_numbered</i> &#x2014; material icon named "format list numbered".
  static format_list_numbered = IconData.new(0xe242, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_list_numbered_rtl</i> &#x2014; material icon named "format list numbered rtl".
  static format_list_numbered_rtl = IconData.new(0xe267, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_paint</i> &#x2014; material icon named "format paint".
  static format_paint = IconData.new(0xe243, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_quote</i> &#x2014; material icon named "format quote".
  static format_quote = IconData.new(0xe244, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_shapes</i> &#x2014; material icon named "format shapes".
  static format_shapes = IconData.new(0xe25e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_size</i> &#x2014; material icon named "format size".
  static format_size = IconData.new(0xe245, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_strikethrough</i> &#x2014; material icon named "format strikethrough".
  static format_strikethrough = IconData.new(0xe246, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_textdirection_l_to_r</i> &#x2014; material icon named "format textdirection l to r".
  static format_textdirection_l_to_r = IconData.new(0xe247, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_textdirection_r_to_l</i> &#x2014; material icon named "format textdirection r to l".
  static format_textdirection_r_to_l = IconData.new(0xe248, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">format_underlined</i> &#x2014; material icon named "format underlined".
  static format_underlined = IconData.new(0xe249, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">forum</i> &#x2014; material icon named "forum".
  static forum = IconData.new(0xe0bf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">forward</i> &#x2014; material icon named "forward".
  static forward = IconData.new(0xe154, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">forward_10</i> &#x2014; material icon named "forward 10".
  static forward_10 = IconData.new(0xe056, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">forward_30</i> &#x2014; material icon named "forward 30".
  static forward_30 = IconData.new(0xe057, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">forward_5</i> &#x2014; material icon named "forward 5".
  static forward_5 = IconData.new(0xe058, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">free_breakfast</i> &#x2014; material icon named "free breakfast".
  static free_breakfast = IconData.new(0xeb44, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fullscreen</i> &#x2014; material icon named "fullscreen".
  static fullscreen = IconData.new(0xe5d0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">fullscreen_exit</i> &#x2014; material icon named "fullscreen exit".
  static fullscreen_exit = IconData.new(0xe5d1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">functions</i> &#x2014; material icon named "functions".
  static functions = IconData.new(0xe24a, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">g_translate</i> &#x2014; material icon named "g translate".
  static g_translate = IconData.new(0xe927, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gamepad</i> &#x2014; material icon named "gamepad".
  static gamepad = IconData.new(0xe30f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">games</i> &#x2014; material icon named "games".
  static games = IconData.new(0xe021, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gavel</i> &#x2014; material icon named "gavel".
  static gavel = IconData.new(0xe90e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gesture</i> &#x2014; material icon named "gesture".
  static gesture = IconData.new(0xe155, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">get_app</i> &#x2014; material icon named "get app".
  static get_app = IconData.new(0xe884, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gif</i> &#x2014; material icon named "gif".
  static gif = IconData.new(0xe908, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">golf_course</i> &#x2014; material icon named "golf course".
  static golf_course = IconData.new(0xeb45, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gps_fixed</i> &#x2014; material icon named "gps fixed".
  static gps_fixed = IconData.new(0xe1b3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gps_not_fixed</i> &#x2014; material icon named "gps not fixed".
  static gps_not_fixed = IconData.new(0xe1b4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gps_off</i> &#x2014; material icon named "gps off".
  static gps_off = IconData.new(0xe1b5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">grade</i> &#x2014; material icon named "grade".
  static grade = IconData.new(0xe885, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">gradient</i> &#x2014; material icon named "gradient".
  static gradient = IconData.new(0xe3e9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">grain</i> &#x2014; material icon named "grain".
  static grain = IconData.new(0xe3ea, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">graphic_eq</i> &#x2014; material icon named "graphic eq".
  static graphic_eq = IconData.new(0xe1b8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">grid_off</i> &#x2014; material icon named "grid off".
  static grid_off = IconData.new(0xe3eb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">grid_on</i> &#x2014; material icon named "grid on".
  static grid_on = IconData.new(0xe3ec, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">group</i> &#x2014; material icon named "group".
  static group = IconData.new(0xe7ef, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">group_add</i> &#x2014; material icon named "group add".
  static group_add = IconData.new(0xe7f0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">group_work</i> &#x2014; material icon named "group work".
  static group_work = IconData.new(0xe886, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hd</i> &#x2014; material icon named "hd".
  static hd = IconData.new(0xe052, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hdr_off</i> &#x2014; material icon named "hdr off".
  static hdr_off = IconData.new(0xe3ed, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hdr_on</i> &#x2014; material icon named "hdr on".
  static hdr_on = IconData.new(0xe3ee, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hdr_strong</i> &#x2014; material icon named "hdr strong".
  static hdr_strong = IconData.new(0xe3f1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hdr_weak</i> &#x2014; material icon named "hdr weak".
  static hdr_weak = IconData.new(0xe3f2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">headset</i> &#x2014; material icon named "headset".
  static headset = IconData.new(0xe310, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">headset_mic</i> &#x2014; material icon named "headset mic".
  static headset_mic = IconData.new(0xe311, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">headset_off</i> &#x2014; material icon named "headset off".
  static headset_off = IconData.new(0xe33a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">healing</i> &#x2014; material icon named "healing".
  static healing = IconData.new(0xe3f3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hearing</i> &#x2014; material icon named "hearing".
  static hearing = IconData.new(0xe023, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">help</i> &#x2014; material icon named "help".
  static help = IconData.new(0xe887, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">help_outline</i> &#x2014; material icon named "help outline".
  static help_outline = IconData.new(0xe8fd, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">high_quality</i> &#x2014; material icon named "high quality".
  static high_quality = IconData.new(0xe024, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">highlight</i> &#x2014; material icon named "highlight".
  static highlight = IconData.new(0xe25f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">highlight_off</i> &#x2014; material icon named "highlight off".
  static highlight_off = IconData.new(0xe888, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">history</i> &#x2014; material icon named "history".
  static history = IconData.new(0xe889, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">home</i> &#x2014; material icon named "home".
  static home = IconData.new(0xe88a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hot_tub</i> &#x2014; material icon named "hot tub".
  static hot_tub = IconData.new(0xeb46, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hotel</i> &#x2014; material icon named "hotel".
  static hotel = IconData.new(0xe53a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hourglass_empty</i> &#x2014; material icon named "hourglass empty".
  static hourglass_empty = IconData.new(0xe88b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">hourglass_full</i> &#x2014; material icon named "hourglass full".
  static hourglass_full = IconData.new(0xe88c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">http</i> &#x2014; material icon named "http".
  static http = IconData.new(0xe902, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">https</i> &#x2014; material icon named "https".
  static https = IconData.new(0xe88d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">image</i> &#x2014; material icon named "image".
  static image = IconData.new(0xe3f4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">image_aspect_ratio</i> &#x2014; material icon named "image aspect ratio".
  static image_aspect_ratio = IconData.new(0xe3f5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">import_contacts</i> &#x2014; material icon named "import contacts".
  static import_contacts = IconData.new(0xe0e0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">import_export</i> &#x2014; material icon named "import export".
  static import_export = IconData.new(0xe0c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">important_devices</i> &#x2014; material icon named "important devices".
  static important_devices = IconData.new(0xe912, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">inbox</i> &#x2014; material icon named "inbox".
  static inbox = IconData.new(0xe156, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">indeterminate_check_box</i> &#x2014; material icon named "indeterminate check box".
  static indeterminate_check_box = IconData.new(0xe909, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">info</i> &#x2014; material icon named "info".
  static info = IconData.new(0xe88e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">info_outline</i> &#x2014; material icon named "info outline".
  static info_outline = IconData.new(0xe88f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">input</i> &#x2014; material icon named "input".
  static input = IconData.new(0xe890, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">insert_chart</i> &#x2014; material icon named "insert chart".
  static insert_chart = IconData.new(0xe24b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_comment</i> &#x2014; material icon named "insert comment".
  static insert_comment = IconData.new(0xe24c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_drive_file</i> &#x2014; material icon named "insert drive file".
  static insert_drive_file = IconData.new(0xe24d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_emoticon</i> &#x2014; material icon named "insert emoticon".
  static insert_emoticon = IconData.new(0xe24e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_invitation</i> &#x2014; material icon named "insert invitation".
  static insert_invitation = IconData.new(0xe24f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_link</i> &#x2014; material icon named "insert link".
  static insert_link = IconData.new(0xe250, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">insert_photo</i> &#x2014; material icon named "insert photo".
  static insert_photo = IconData.new(0xe251, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">invert_colors</i> &#x2014; material icon named "invert colors".
  static invert_colors = IconData.new(0xe891, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">invert_colors_off</i> &#x2014; material icon named "invert colors off".
  static invert_colors_off = IconData.new(0xe0c4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">iso</i> &#x2014; material icon named "iso".
  static iso = IconData.new(0xe3f6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard</i> &#x2014; material icon named "keyboard".
  static keyboard = IconData.new(0xe312, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_arrow_down</i> &#x2014; material icon named "keyboard arrow down".
  static keyboard_arrow_down = IconData.new(0xe313, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_arrow_left</i> &#x2014; material icon named "keyboard arrow left".
  static keyboard_arrow_left = IconData.new(0xe314, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_arrow_right</i> &#x2014; material icon named "keyboard arrow right".
  static keyboard_arrow_right = IconData.new(0xe315, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_arrow_up</i> &#x2014; material icon named "keyboard arrow up".
  static keyboard_arrow_up = IconData.new(0xe316, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_backspace</i> &#x2014; material icon named "keyboard backspace".
  static keyboard_backspace = IconData.new(0xe317, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">keyboard_capslock</i> &#x2014; material icon named "keyboard capslock".
  static keyboard_capslock = IconData.new(0xe318, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_hide</i> &#x2014; material icon named "keyboard hide".
  static keyboard_hide = IconData.new(0xe31a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_return</i> &#x2014; material icon named "keyboard return".
  static keyboard_return = IconData.new(0xe31b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">keyboard_tab</i> &#x2014; material icon named "keyboard tab".
  static keyboard_tab = IconData.new(0xe31c, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">keyboard_voice</i> &#x2014; material icon named "keyboard voice".
  static keyboard_voice = IconData.new(0xe31d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">kitchen</i> &#x2014; material icon named "kitchen".
  static kitchen = IconData.new(0xeb47, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">label</i> &#x2014; material icon named "label".
  static label = IconData.new(0xe892, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">label_important</i> &#x2014; material icon named "label important".
  static label_important = IconData.new(0xe937, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">label_outline</i> &#x2014; material icon named "label outline".
  static label_outline = IconData.new(0xe893, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">landscape</i> &#x2014; material icon named "landscape".
  static landscape = IconData.new(0xe3f7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">language</i> &#x2014; material icon named "language".
  static language = IconData.new(0xe894, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">laptop</i> &#x2014; material icon named "laptop".
  static laptop = IconData.new(0xe31e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">laptop_chromebook</i> &#x2014; material icon named "laptop chromebook".
  static laptop_chromebook = IconData.new(0xe31f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">laptop_mac</i> &#x2014; material icon named "laptop mac".
  static laptop_mac = IconData.new(0xe320, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">laptop_windows</i> &#x2014; material icon named "laptop windows".
  static laptop_windows = IconData.new(0xe321, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">last_page</i> &#x2014; material icon named "last page".
  static last_page = IconData.new(0xe5dd, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">launch</i> &#x2014; material icon named "launch".
  static launch = IconData.new(0xe895, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">layers</i> &#x2014; material icon named "layers".
  static layers = IconData.new(0xe53b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">layers_clear</i> &#x2014; material icon named "layers clear".
  static layers_clear = IconData.new(0xe53c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">leak_add</i> &#x2014; material icon named "leak add".
  static leak_add = IconData.new(0xe3f8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">leak_remove</i> &#x2014; material icon named "leak remove".
  static leak_remove = IconData.new(0xe3f9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">lens</i> &#x2014; material icon named "lens".
  static lens = IconData.new(0xe3fa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">library_add</i> &#x2014; material icon named "library add".
  static library_add = IconData.new(0xe02e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">library_books</i> &#x2014; material icon named "library books".
  static library_books = IconData.new(0xe02f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">library_music</i> &#x2014; material icon named "library music".
  static library_music = IconData.new(0xe030, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">lightbulb_outline</i> &#x2014; material icon named "lightbulb outline".
  static lightbulb_outline = IconData.new(0xe90f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">line_style</i> &#x2014; material icon named "line style".
  static line_style = IconData.new(0xe919, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">line_weight</i> &#x2014; material icon named "line weight".
  static line_weight = IconData.new(0xe91a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">linear_scale</i> &#x2014; material icon named "linear scale".
  static linear_scale = IconData.new(0xe260, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">link</i> &#x2014; material icon named "link".
  static link = IconData.new(0xe157, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">link_off</i> &#x2014; material icon named "link off".
  static link_off = IconData.new(0xe16f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">linked_camera</i> &#x2014; material icon named "linked camera".
  static linked_camera = IconData.new(0xe438, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">list</i> &#x2014; material icon named "list".
  static list = IconData.new(0xe896, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">live_help</i> &#x2014; material icon named "live help".
  static live_help = IconData.new(0xe0c6, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">live_tv</i> &#x2014; material icon named "live tv".
  static live_tv = IconData.new(0xe639, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_activity</i> &#x2014; material icon named "local activity".
  static local_activity = IconData.new(0xe53f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_airport</i> &#x2014; material icon named "local airport".
  static local_airport = IconData.new(0xe53d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_atm</i> &#x2014; material icon named "local atm".
  static local_atm = IconData.new(0xe53e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_bar</i> &#x2014; material icon named "local bar".
  static local_bar = IconData.new(0xe540, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_cafe</i> &#x2014; material icon named "local cafe".
  static local_cafe = IconData.new(0xe541, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_car_wash</i> &#x2014; material icon named "local car wash".
  static local_car_wash = IconData.new(0xe542, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_convenience_store</i> &#x2014; material icon named "local convenience store".
  static local_convenience_store = IconData.new(0xe543, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_dining</i> &#x2014; material icon named "local dining".
  static local_dining = IconData.new(0xe556, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_drink</i> &#x2014; material icon named "local drink".
  static local_drink = IconData.new(0xe544, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_florist</i> &#x2014; material icon named "local florist".
  static local_florist = IconData.new(0xe545, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_gas_station</i> &#x2014; material icon named "local gas station".
  static local_gas_station = IconData.new(0xe546, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_grocery_store</i> &#x2014; material icon named "local grocery store".
  static local_grocery_store = IconData.new(0xe547, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_hospital</i> &#x2014; material icon named "local hospital".
  static local_hospital = IconData.new(0xe548, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_hotel</i> &#x2014; material icon named "local hotel".
  static local_hotel = IconData.new(0xe549, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_laundry_service</i> &#x2014; material icon named "local laundry service".
  static local_laundry_service = IconData.new(0xe54a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_library</i> &#x2014; material icon named "local library".
  static local_library = IconData.new(0xe54b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_mall</i> &#x2014; material icon named "local mall".
  static local_mall = IconData.new(0xe54c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_movies</i> &#x2014; material icon named "local movies".
  static local_movies = IconData.new(0xe54d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_offer</i> &#x2014; material icon named "local offer".
  static local_offer = IconData.new(0xe54e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_parking</i> &#x2014; material icon named "local parking".
  static local_parking = IconData.new(0xe54f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_pharmacy</i> &#x2014; material icon named "local pharmacy".
  static local_pharmacy = IconData.new(0xe550, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_phone</i> &#x2014; material icon named "local phone".
  static local_phone = IconData.new(0xe551, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_pizza</i> &#x2014; material icon named "local pizza".
  static local_pizza = IconData.new(0xe552, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_play</i> &#x2014; material icon named "local play".
  static local_play = IconData.new(0xe553, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_post_office</i> &#x2014; material icon named "local post office".
  static local_post_office = IconData.new(0xe554, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_printshop</i> &#x2014; material icon named "local printshop".
  static local_printshop = IconData.new(0xe555, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_see</i> &#x2014; material icon named "local see".
  static local_see = IconData.new(0xe557, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_shipping</i> &#x2014; material icon named "local shipping".
  static local_shipping = IconData.new(0xe558, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">local_taxi</i> &#x2014; material icon named "local taxi".
  static local_taxi = IconData.new(0xe559, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">location_city</i> &#x2014; material icon named "location city".
  static location_city = IconData.new(0xe7f1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">location_disabled</i> &#x2014; material icon named "location disabled".
  static location_disabled = IconData.new(0xe1b6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">location_off</i> &#x2014; material icon named "location off".
  static location_off = IconData.new(0xe0c7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">location_on</i> &#x2014; material icon named "location on".
  static location_on = IconData.new(0xe0c8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">location_searching</i> &#x2014; material icon named "location searching".
  static location_searching = IconData.new(0xe1b7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">lock</i> &#x2014; material icon named "lock".
  static lock = IconData.new(0xe897, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">lock_open</i> &#x2014; material icon named "lock open".
  static lock_open = IconData.new(0xe898, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">lock_outline</i> &#x2014; material icon named "lock outline".
  static lock_outline = IconData.new(0xe899, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks</i> &#x2014; material icon named "looks".
  static looks = IconData.new(0xe3fc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_3</i> &#x2014; material icon named "looks 3".
  static looks_3 = IconData.new(0xe3fb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_4</i> &#x2014; material icon named "looks 4".
  static looks_4 = IconData.new(0xe3fd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_5</i> &#x2014; material icon named "looks 5".
  static looks_5 = IconData.new(0xe3fe, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_6</i> &#x2014; material icon named "looks 6".
  static looks_6 = IconData.new(0xe3ff, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_one</i> &#x2014; material icon named "looks one".
  static looks_one = IconData.new(0xe400, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">looks_two</i> &#x2014; material icon named "looks two".
  static looks_two = IconData.new(0xe401, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">loop</i> &#x2014; material icon named "loop".
  static loop = IconData.new(0xe028, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">loupe</i> &#x2014; material icon named "loupe".
  static loupe = IconData.new(0xe402, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">low_priority</i> &#x2014; material icon named "low priority".
  static low_priority = IconData.new(0xe16d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">loyalty</i> &#x2014; material icon named "loyalty".
  static loyalty = IconData.new(0xe89a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mail</i> &#x2014; material icon named "mail".
  static mail = IconData.new(0xe158, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mail_outline</i> &#x2014; material icon named "mail outline".
  static mail_outline = IconData.new(0xe0e1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">map</i> &#x2014; material icon named "map".
  static map = IconData.new(0xe55b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">markunread</i> &#x2014; material icon named "markunread".
  static markunread = IconData.new(0xe159, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">markunread_mailbox</i> &#x2014; material icon named "markunread mailbox".
  static markunread_mailbox = IconData.new(0xe89b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">maximize</i> &#x2014; material icon named "maximize".
  static maximize = IconData.new(0xe930, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">memory</i> &#x2014; material icon named "memory".
  static memory = IconData.new(0xe322, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">menu</i> &#x2014; material icon named "menu".
  static menu = IconData.new(0xe5d2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">merge_type</i> &#x2014; material icon named "merge type".
  static merge_type = IconData.new(0xe252, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">message</i> &#x2014; material icon named "message".
  static message = IconData.new(0xe0c9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mic</i> &#x2014; material icon named "mic".
  static mic = IconData.new(0xe029, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mic_none</i> &#x2014; material icon named "mic none".
  static mic_none = IconData.new(0xe02a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mic_off</i> &#x2014; material icon named "mic off".
  static mic_off = IconData.new(0xe02b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">minimize</i> &#x2014; material icon named "minimize".
  static minimize = IconData.new(0xe931, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">missed_video_call</i> &#x2014; material icon named "missed video call".
  static missed_video_call = IconData.new(0xe073, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mms</i> &#x2014; material icon named "mms".
  static mms = IconData.new(0xe618, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mobile_screen_share</i> &#x2014; material icon named "mobile screen share".
  static mobile_screen_share = IconData.new(0xe0e7, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">mode_comment</i> &#x2014; material icon named "mode comment".
  static mode_comment = IconData.new(0xe253, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mode_edit</i> &#x2014; material icon named "mode edit".
  static mode_edit = IconData.new(0xe254, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">monetization_on</i> &#x2014; material icon named "monetization on".
  static monetization_on = IconData.new(0xe263, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">money_off</i> &#x2014; material icon named "money off".
  static money_off = IconData.new(0xe25c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">monochrome_photos</i> &#x2014; material icon named "monochrome photos".
  static monochrome_photos = IconData.new(0xe403, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mood</i> &#x2014; material icon named "mood".
  static mood = IconData.new(0xe7f2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mood_bad</i> &#x2014; material icon named "mood bad".
  static mood_bad = IconData.new(0xe7f3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">more</i> &#x2014; material icon named "more".
  static more = IconData.new(0xe619, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">more_horiz</i> &#x2014; material icon named "more horiz".
  static more_horiz = IconData.new(0xe5d3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">more_vert</i> &#x2014; material icon named "more vert".
  static more_vert = IconData.new(0xe5d4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">motorcycle</i> &#x2014; material icon named "motorcycle".
  static motorcycle = IconData.new(0xe91b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">mouse</i> &#x2014; material icon named "mouse".
  static mouse = IconData.new(0xe323, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">move_to_inbox</i> &#x2014; material icon named "move to inbox".
  static move_to_inbox = IconData.new(0xe168, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">movie</i> &#x2014; material icon named "movie".
  static movie = IconData.new(0xe02c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">movie_creation</i> &#x2014; material icon named "movie creation".
  static movie_creation = IconData.new(0xe404, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">movie_filter</i> &#x2014; material icon named "movie filter".
  static movie_filter = IconData.new(0xe43a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">multiline_chart</i> &#x2014; material icon named "multiline chart".
  static multiline_chart = IconData.new(0xe6df, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">music_note</i> &#x2014; material icon named "music note".
  static music_note = IconData.new(0xe405, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">music_video</i> &#x2014; material icon named "music video".
  static music_video = IconData.new(0xe063, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">my_location</i> &#x2014; material icon named "my location".
  static my_location = IconData.new(0xe55c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">nature</i> &#x2014; material icon named "nature".
  static nature = IconData.new(0xe406, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">nature_people</i> &#x2014; material icon named "nature people".
  static nature_people = IconData.new(0xe407, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">navigate_before</i> &#x2014; material icon named "navigate before".
  static navigate_before = IconData.new(0xe408, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">navigate_next</i> &#x2014; material icon named "navigate next".
  static navigate_next = IconData.new(0xe409, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">navigation</i> &#x2014; material icon named "navigation".
  static navigation = IconData.new(0xe55d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">near_me</i> &#x2014; material icon named "near me".
  static near_me = IconData.new(0xe569, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">network_cell</i> &#x2014; material icon named "network cell".
  static network_cell = IconData.new(0xe1b9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">network_check</i> &#x2014; material icon named "network check".
  static network_check = IconData.new(0xe640, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">network_locked</i> &#x2014; material icon named "network locked".
  static network_locked = IconData.new(0xe61a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">network_wifi</i> &#x2014; material icon named "network wifi".
  static network_wifi = IconData.new(0xe1ba, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">new_releases</i> &#x2014; material icon named "new releases".
  static new_releases = IconData.new(0xe031, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">next_week</i> &#x2014; material icon named "next week".
  static next_week = IconData.new(0xe16a, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">nfc</i> &#x2014; material icon named "nfc".
  static nfc = IconData.new(0xe1bb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">no_encryption</i> &#x2014; material icon named "no encryption".
  static no_encryption = IconData.new(0xe641, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">no_sim</i> &#x2014; material icon named "no sim".
  static no_sim = IconData.new(0xe0cc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">not_interested</i> &#x2014; material icon named "not interested".
  static not_interested = IconData.new(0xe033, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">not_listed_location</i> &#x2014; material icon named "not listed location".
  static not_listed_location = IconData.new(0xe575, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">note</i> &#x2014; material icon named "note".
  static note = IconData.new(0xe06f, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">note_add</i> &#x2014; material icon named "note add".
  static note_add = IconData.new(0xe89c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notification_important</i> &#x2014; material icon named "notification important".
  static notification_important = IconData.new(0xe004, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notifications</i> &#x2014; material icon named "notifications".
  static notifications = IconData.new(0xe7f4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notifications_active</i> &#x2014; material icon named "notifications active".
  static notifications_active = IconData.new(0xe7f7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notifications_none</i> &#x2014; material icon named "notifications none".
  static notifications_none = IconData.new(0xe7f5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notifications_off</i> &#x2014; material icon named "notifications off".
  static notifications_off = IconData.new(0xe7f6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">notifications_paused</i> &#x2014; material icon named "notifications paused".
  static notifications_paused = IconData.new(0xe7f8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">offline_bolt</i> &#x2014; material icon named "offline bolt".
  static offline_bolt = IconData.new(0xe932, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">offline_pin</i> &#x2014; material icon named "offline pin".
  static offline_pin = IconData.new(0xe90a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">ondemand_video</i> &#x2014; material icon named "ondemand video".
  static ondemand_video = IconData.new(0xe63a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">opacity</i> &#x2014; material icon named "opacity".
  static opacity = IconData.new(0xe91c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">open_in_browser</i> &#x2014; material icon named "open in browser".
  static open_in_browser = IconData.new(0xe89d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">open_in_new</i> &#x2014; material icon named "open in new".
  static open_in_new = IconData.new(0xe89e, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">open_with</i> &#x2014; material icon named "open with".
  static open_with = IconData.new(0xe89f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">outlined_flag</i> &#x2014; material icon named "outlined flag".
  static outlined_flag = IconData.new(0xe16e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pages</i> &#x2014; material icon named "pages".
  static pages = IconData.new(0xe7f9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pageview</i> &#x2014; material icon named "pageview".
  static pageview = IconData.new(0xe8a0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">palette</i> &#x2014; material icon named "palette".
  static palette = IconData.new(0xe40a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pan_tool</i> &#x2014; material icon named "pan tool".
  static pan_tool = IconData.new(0xe925, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">panorama</i> &#x2014; material icon named "panorama".
  static panorama = IconData.new(0xe40b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">panorama_fish_eye</i> &#x2014; material icon named "panorama fish eye".
  static panorama_fish_eye = IconData.new(0xe40c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">panorama_horizontal</i> &#x2014; material icon named "panorama horizontal".
  static panorama_horizontal = IconData.new(0xe40d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">panorama_vertical</i> &#x2014; material icon named "panorama vertical".
  static panorama_vertical = IconData.new(0xe40e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">panorama_wide_angle</i> &#x2014; material icon named "panorama wide angle".
  static panorama_wide_angle = IconData.new(0xe40f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">party_mode</i> &#x2014; material icon named "party mode".
  static party_mode = IconData.new(0xe7fa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pause</i> &#x2014; material icon named "pause".
  static pause = IconData.new(0xe034, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pause_circle_filled</i> &#x2014; material icon named "pause circle filled".
  static pause_circle_filled = IconData.new(0xe035, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pause_circle_outline</i> &#x2014; material icon named "pause circle outline".
  static pause_circle_outline = IconData.new(0xe036, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">payment</i> &#x2014; material icon named "payment".
  static payment = IconData.new(0xe8a1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">people</i> &#x2014; material icon named "people".
  static people = IconData.new(0xe7fb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">people_outline</i> &#x2014; material icon named "people outline".
  static people_outline = IconData.new(0xe7fc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_camera_mic</i> &#x2014; material icon named "perm camera mic".
  static perm_camera_mic = IconData.new(0xe8a2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_contact_calendar</i> &#x2014; material icon named "perm contact calendar".
  static perm_contact_calendar = IconData.new(0xe8a3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_data_setting</i> &#x2014; material icon named "perm data setting".
  static perm_data_setting = IconData.new(0xe8a4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_device_information</i> &#x2014; material icon named "perm device information".
  static perm_device_information = IconData.new(0xe8a5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_identity</i> &#x2014; material icon named "perm identity".
  static perm_identity = IconData.new(0xe8a6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_media</i> &#x2014; material icon named "perm media".
  static perm_media = IconData.new(0xe8a7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_phone_msg</i> &#x2014; material icon named "perm phone msg".
  static perm_phone_msg = IconData.new(0xe8a8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">perm_scan_wifi</i> &#x2014; material icon named "perm scan wifi".
  static perm_scan_wifi = IconData.new(0xe8a9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">person</i> &#x2014; material icon named "person".
  static person = IconData.new(0xe7fd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">person_add</i> &#x2014; material icon named "person add".
  static person_add = IconData.new(0xe7fe, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">person_outline</i> &#x2014; material icon named "person outline".
  static person_outline = IconData.new(0xe7ff, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">person_pin</i> &#x2014; material icon named "person pin".
  static person_pin = IconData.new(0xe55a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">person_pin_circle</i> &#x2014; material icon named "person pin circle".
  static person_pin_circle = IconData.new(0xe56a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">personal_video</i> &#x2014; material icon named "personal video".
  static personal_video = IconData.new(0xe63b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pets</i> &#x2014; material icon named "pets".
  static pets = IconData.new(0xe91d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone</i> &#x2014; material icon named "phone".
  static phone = IconData.new(0xe0cd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_android</i> &#x2014; material icon named "phone android".
  static phone_android = IconData.new(0xe324, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_bluetooth_speaker</i> &#x2014; material icon named "phone bluetooth speaker".
  static phone_bluetooth_speaker = IconData.new(0xe61b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_forwarded</i> &#x2014; material icon named "phone forwarded".
  static phone_forwarded = IconData.new(0xe61c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_in_talk</i> &#x2014; material icon named "phone in talk".
  static phone_in_talk = IconData.new(0xe61d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_iphone</i> &#x2014; material icon named "phone iphone".
  static phone_iphone = IconData.new(0xe325, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_locked</i> &#x2014; material icon named "phone locked".
  static phone_locked = IconData.new(0xe61e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_missed</i> &#x2014; material icon named "phone missed".
  static phone_missed = IconData.new(0xe61f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phone_paused</i> &#x2014; material icon named "phone paused".
  static phone_paused = IconData.new(0xe620, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink</i> &#x2014; material icon named "phonelink".
  static phonelink = IconData.new(0xe326, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink_erase</i> &#x2014; material icon named "phonelink erase".
  static phonelink_erase = IconData.new(0xe0db, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink_lock</i> &#x2014; material icon named "phonelink lock".
  static phonelink_lock = IconData.new(0xe0dc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink_off</i> &#x2014; material icon named "phonelink off".
  static phonelink_off = IconData.new(0xe327, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink_ring</i> &#x2014; material icon named "phonelink ring".
  static phonelink_ring = IconData.new(0xe0dd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">phonelink_setup</i> &#x2014; material icon named "phonelink setup".
  static phonelink_setup = IconData.new(0xe0de, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo</i> &#x2014; material icon named "photo".
  static photo = IconData.new(0xe410, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_album</i> &#x2014; material icon named "photo album".
  static photo_album = IconData.new(0xe411, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_camera</i> &#x2014; material icon named "photo camera".
  static photo_camera = IconData.new(0xe412, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_filter</i> &#x2014; material icon named "photo filter".
  static photo_filter = IconData.new(0xe43b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_library</i> &#x2014; material icon named "photo library".
  static photo_library = IconData.new(0xe413, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_size_select_actual</i> &#x2014; material icon named "photo size select actual".
  static photo_size_select_actual = IconData.new(0xe432, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_size_select_large</i> &#x2014; material icon named "photo size select large".
  static photo_size_select_large = IconData.new(0xe433, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">photo_size_select_small</i> &#x2014; material icon named "photo size select small".
  static photo_size_select_small = IconData.new(0xe434, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">picture_as_pdf</i> &#x2014; material icon named "picture as pdf".
  static picture_as_pdf = IconData.new(0xe415, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">picture_in_picture</i> &#x2014; material icon named "picture in picture".
  static picture_in_picture = IconData.new(0xe8aa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">picture_in_picture_alt</i> &#x2014; material icon named "picture in picture alt".
  static picture_in_picture_alt = IconData.new(0xe911, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pie_chart</i> &#x2014; material icon named "pie chart".
  static pie_chart = IconData.new(0xe6c4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pie_chart_outlined</i> &#x2014; material icon named "pie chart outlined".
  static pie_chart_outlined = IconData.new(0xe6c5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pin_drop</i> &#x2014; material icon named "pin drop".
  static pin_drop = IconData.new(0xe55e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">place</i> &#x2014; material icon named "place".
  static place = IconData.new(0xe55f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">play_arrow</i> &#x2014; material icon named "play arrow".
  static play_arrow = IconData.new(0xe037, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">play_circle_filled</i> &#x2014; material icon named "play circle filled".
  static play_circle_filled = IconData.new(0xe038, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">play_circle_outline</i> &#x2014; material icon named "play circle outline".
  static play_circle_outline = IconData.new(0xe039, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">play_for_work</i> &#x2014; material icon named "play for work".
  static play_for_work = IconData.new(0xe906, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">playlist_add</i> &#x2014; material icon named "playlist add".
  static playlist_add = IconData.new(0xe03b, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">playlist_add_check</i> &#x2014; material icon named "playlist add check".
  static playlist_add_check = IconData.new(0xe065, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">playlist_play</i> &#x2014; material icon named "playlist play".
  static playlist_play = IconData.new(0xe05f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">plus_one</i> &#x2014; material icon named "plus one".
  static plus_one = IconData.new(0xe800, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">poll</i> &#x2014; material icon named "poll".
  static poll = IconData.new(0xe801, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">polymer</i> &#x2014; material icon named "polymer".
  static polymer = IconData.new(0xe8ab, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pool</i> &#x2014; material icon named "pool".
  static pool = IconData.new(0xeb48, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">portable_wifi_off</i> &#x2014; material icon named "portable wifi off".
  static portable_wifi_off = IconData.new(0xe0ce, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">portrait</i> &#x2014; material icon named "portrait".
  static portrait = IconData.new(0xe416, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">power</i> &#x2014; material icon named "power".
  static power = IconData.new(0xe63c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">power_input</i> &#x2014; material icon named "power input".
  static power_input = IconData.new(0xe336, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">power_settings_new</i> &#x2014; material icon named "power settings new".
  static power_settings_new = IconData.new(0xe8ac, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">pregnant_woman</i> &#x2014; material icon named "pregnant woman".
  static pregnant_woman = IconData.new(0xe91e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">present_to_all</i> &#x2014; material icon named "present to all".
  static present_to_all = IconData.new(0xe0df, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">print</i> &#x2014; material icon named "print".
  static print = IconData.new(0xe8ad, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">priority_high</i> &#x2014; material icon named "priority high".
  static priority_high = IconData.new(0xe645, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">public</i> &#x2014; material icon named "public".
  static public = IconData.new(0xe80b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">publish</i> &#x2014; material icon named "publish".
  static publish = IconData.new(0xe255, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">query_builder</i> &#x2014; material icon named "query builder".
  static query_builder = IconData.new(0xe8ae, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">question_answer</i> &#x2014; material icon named "question answer".
  static question_answer = IconData.new(0xe8af, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">queue</i> &#x2014; material icon named "queue".
  static queue = IconData.new(0xe03c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">queue_music</i> &#x2014; material icon named "queue music".
  static queue_music = IconData.new(0xe03d, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">queue_play_next</i> &#x2014; material icon named "queue play next".
  static queue_play_next = IconData.new(0xe066, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">radio</i> &#x2014; material icon named "radio".
  static radio = IconData.new(0xe03e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">radio_button_checked</i> &#x2014; material icon named "radio button checked".
  static radio_button_checked = IconData.new(0xe837, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">radio_button_unchecked</i> &#x2014; material icon named "radio button unchecked".
  static radio_button_unchecked = IconData.new(0xe836, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rate_review</i> &#x2014; material icon named "rate review".
  static rate_review = IconData.new(0xe560, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">receipt</i> &#x2014; material icon named "receipt".
  static receipt = IconData.new(0xe8b0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">recent_actors</i> &#x2014; material icon named "recent actors".
  static recent_actors = IconData.new(0xe03f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">record_voice_over</i> &#x2014; material icon named "record voice over".
  static record_voice_over = IconData.new(0xe91f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">redeem</i> &#x2014; material icon named "redeem".
  static redeem = IconData.new(0xe8b1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">redo</i> &#x2014; material icon named "redo".
  static redo = IconData.new(0xe15a, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">refresh</i> &#x2014; material icon named "refresh".
  static refresh = IconData.new(0xe5d5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove</i> &#x2014; material icon named "remove".
  static remove = IconData.new(0xe15b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove_circle</i> &#x2014; material icon named "remove circle".
  static remove_circle = IconData.new(0xe15c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove_circle_outline</i> &#x2014; material icon named "remove circle outline".
  static remove_circle_outline = IconData.new(0xe15d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove_from_queue</i> &#x2014; material icon named "remove from queue".
  static remove_from_queue = IconData.new(0xe067, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove_red_eye</i> &#x2014; material icon named "remove red eye".
  static remove_red_eye = IconData.new(0xe417, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">remove_shopping_cart</i> &#x2014; material icon named "remove shopping cart".
  static remove_shopping_cart = IconData.new(0xe928, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">reorder</i> &#x2014; material icon named "reorder".
  static reorder = IconData.new(0xe8fe, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">repeat</i> &#x2014; material icon named "repeat".
  static repeat = IconData.new(0xe040, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">repeat_one</i> &#x2014; material icon named "repeat one".
  static repeat_one = IconData.new(0xe041, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">replay</i> &#x2014; material icon named "replay".
  static replay = IconData.new(0xe042, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">replay_10</i> &#x2014; material icon named "replay 10".
  static replay_10 = IconData.new(0xe059, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">replay_30</i> &#x2014; material icon named "replay 30".
  static replay_30 = IconData.new(0xe05a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">replay_5</i> &#x2014; material icon named "replay 5".
  static replay_5 = IconData.new(0xe05b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">reply</i> &#x2014; material icon named "reply".
  static reply = IconData.new(0xe15e, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">reply_all</i> &#x2014; material icon named "reply all".
  static reply_all = IconData.new(0xe15f, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">report</i> &#x2014; material icon named "report".
  static report = IconData.new(0xe160, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">report_off</i> &#x2014; material icon named "report off".
  static report_off = IconData.new(0xe170, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">report_problem</i> &#x2014; material icon named "report problem".
  static report_problem = IconData.new(0xe8b2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">restaurant</i> &#x2014; material icon named "restaurant".
  static restaurant = IconData.new(0xe56c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">restaurant_menu</i> &#x2014; material icon named "restaurant menu".
  static restaurant_menu = IconData.new(0xe561, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">restore</i> &#x2014; material icon named "restore".
  static restore = IconData.new(0xe8b3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">restore_from_trash</i> &#x2014; material icon named "restore from trash".
  static restore_from_trash = IconData.new(0xe938, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">restore_page</i> &#x2014; material icon named "restore page".
  static restore_page = IconData.new(0xe929, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">ring_volume</i> &#x2014; material icon named "ring volume".
  static ring_volume = IconData.new(0xe0d1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">room</i> &#x2014; material icon named "room".
  static room = IconData.new(0xe8b4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">room_service</i> &#x2014; material icon named "room service".
  static room_service = IconData.new(0xeb49, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rotate_90_degrees_ccw</i> &#x2014; material icon named "rotate 90 degrees ccw".
  static rotate_90_degrees_ccw = IconData.new(0xe418, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rotate_left</i> &#x2014; material icon named "rotate left".
  static rotate_left = IconData.new(0xe419, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rotate_right</i> &#x2014; material icon named "rotate right".
  static rotate_right = IconData.new(0xe41a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rounded_corner</i> &#x2014; material icon named "rounded corner".
  static rounded_corner = IconData.new(0xe920, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">router</i> &#x2014; material icon named "router".
  static router = IconData.new(0xe328, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rowing</i> &#x2014; material icon named "rowing".
  static rowing = IconData.new(0xe921, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rss_feed</i> &#x2014; material icon named "rss feed".
  static rss_feed = IconData.new(0xe0e5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">rv_hookup</i> &#x2014; material icon named "rv hookup".
  static rv_hookup = IconData.new(0xe642, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">satellite</i> &#x2014; material icon named "satellite".
  static satellite = IconData.new(0xe562, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">save</i> &#x2014; material icon named "save".
  static save = IconData.new(0xe161, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">save_alt</i> &#x2014; material icon named "save alt".
  static save_alt = IconData.new(0xe171, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">scanner</i> &#x2014; material icon named "scanner".
  static scanner = IconData.new(0xe329, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">scatter_plot</i> &#x2014; material icon named "scatter plot".
  static scatter_plot = IconData.new(0xe268, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">schedule</i> &#x2014; material icon named "schedule".
  static schedule = IconData.new(0xe8b5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">school</i> &#x2014; material icon named "school".
  static school = IconData.new(0xe80c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">score</i> &#x2014; material icon named "score".
  static score = IconData.new(0xe269, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">screen_lock_landscape</i> &#x2014; material icon named "screen lock landscape".
  static screen_lock_landscape = IconData.new(0xe1be, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">screen_lock_portrait</i> &#x2014; material icon named "screen lock portrait".
  static screen_lock_portrait = IconData.new(0xe1bf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">screen_lock_rotation</i> &#x2014; material icon named "screen lock rotation".
  static screen_lock_rotation = IconData.new(0xe1c0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">screen_rotation</i> &#x2014; material icon named "screen rotation".
  static screen_rotation = IconData.new(0xe1c1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">screen_share</i> &#x2014; material icon named "screen share".
  static screen_share = IconData.new(0xe0e2, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">sd_card</i> &#x2014; material icon named "sd card".
  static sd_card = IconData.new(0xe623, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sd_storage</i> &#x2014; material icon named "sd storage".
  static sd_storage = IconData.new(0xe1c2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">search</i> &#x2014; material icon named "search".
  static search = IconData.new(0xe8b6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">security</i> &#x2014; material icon named "security".
  static security = IconData.new(0xe32a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">select_all</i> &#x2014; material icon named "select all".
  static select_all = IconData.new(0xe162, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">send</i> &#x2014; material icon named "send".
  static send = IconData.new(0xe163, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">sentiment_dissatisfied</i> &#x2014; material icon named "sentiment dissatisfied".
  static sentiment_dissatisfied = IconData.new(0xe811, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sentiment_neutral</i> &#x2014; material icon named "sentiment neutral".
  static sentiment_neutral = IconData.new(0xe812, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sentiment_satisfied</i> &#x2014; material icon named "sentiment satisfied".
  static sentiment_satisfied = IconData.new(0xe813, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sentiment_very_dissatisfied</i> &#x2014; material icon named "sentiment very dissatisfied".
  static sentiment_very_dissatisfied = IconData.new(0xe814, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sentiment_very_satisfied</i> &#x2014; material icon named "sentiment very satisfied".
  static sentiment_very_satisfied = IconData.new(0xe815, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings</i> &#x2014; material icon named "settings".
  static settings = IconData.new(0xe8b8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_applications</i> &#x2014; material icon named "settings applications".
  static settings_applications = IconData.new(0xe8b9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_backup_restore</i> &#x2014; material icon named "settings backup restore".
  static settings_backup_restore = IconData.new(0xe8ba, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_bluetooth</i> &#x2014; material icon named "settings bluetooth".
  static settings_bluetooth = IconData.new(0xe8bb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_brightness</i> &#x2014; material icon named "settings brightness".
  static settings_brightness = IconData.new(0xe8bd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_cell</i> &#x2014; material icon named "settings cell".
  static settings_cell = IconData.new(0xe8bc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_ethernet</i> &#x2014; material icon named "settings ethernet".
  static settings_ethernet = IconData.new(0xe8be, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_input_antenna</i> &#x2014; material icon named "settings input antenna".
  static settings_input_antenna = IconData.new(0xe8bf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_input_component</i> &#x2014; material icon named "settings input component".
  static settings_input_component = IconData.new(0xe8c0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_input_composite</i> &#x2014; material icon named "settings input composite".
  static settings_input_composite = IconData.new(0xe8c1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_input_hdmi</i> &#x2014; material icon named "settings input hdmi".
  static settings_input_hdmi = IconData.new(0xe8c2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_input_svideo</i> &#x2014; material icon named "settings input svideo".
  static settings_input_svideo = IconData.new(0xe8c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_overscan</i> &#x2014; material icon named "settings overscan".
  static settings_overscan = IconData.new(0xe8c4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_phone</i> &#x2014; material icon named "settings phone".
  static settings_phone = IconData.new(0xe8c5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_power</i> &#x2014; material icon named "settings power".
  static settings_power = IconData.new(0xe8c6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_remote</i> &#x2014; material icon named "settings remote".
  static settings_remote = IconData.new(0xe8c7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_system_daydream</i> &#x2014; material icon named "settings system daydream".
  static settings_system_daydream = IconData.new(0xe1c3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">settings_voice</i> &#x2014; material icon named "settings voice".
  static settings_voice = IconData.new(0xe8c8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">share</i> &#x2014; material icon named "share".
  static share = IconData.new(0xe80d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">shop</i> &#x2014; material icon named "shop".
  static shop = IconData.new(0xe8c9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">shop_two</i> &#x2014; material icon named "shop two".
  static shop_two = IconData.new(0xe8ca, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">shopping_basket</i> &#x2014; material icon named "shopping basket".
  static shopping_basket = IconData.new(0xe8cb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">shopping_cart</i> &#x2014; material icon named "shopping cart".
  static shopping_cart = IconData.new(0xe8cc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">short_text</i> &#x2014; material icon named "short text".
  static short_text = IconData.new(0xe261, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">show_chart</i> &#x2014; material icon named "show chart".
  static show_chart = IconData.new(0xe6e1, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">shuffle</i> &#x2014; material icon named "shuffle".
  static shuffle = IconData.new(0xe043, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">shutter_speed</i> &#x2014; material icon named "shutter speed".
  static shutter_speed = IconData.new(0xe43d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_cellular_4_bar</i> &#x2014; material icon named "signal cellular 4 bar".
  static signal_cellular_4_bar = IconData.new(0xe1c8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_cellular_connected_no_internet_4_bar</i> &#x2014; material icon named "signal cellular connected no internet 4 bar".
  static signal_cellular_connected_no_internet_4_bar = IconData.new(0xe1cd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_cellular_no_sim</i> &#x2014; material icon named "signal cellular no sim".
  static signal_cellular_no_sim = IconData.new(0xe1ce, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_cellular_null</i> &#x2014; material icon named "signal cellular null".
  static signal_cellular_null = IconData.new(0xe1cf, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_cellular_off</i> &#x2014; material icon named "signal cellular off".
  static signal_cellular_off = IconData.new(0xe1d0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_wifi_4_bar</i> &#x2014; material icon named "signal wifi 4 bar".
  static signal_wifi_4_bar = IconData.new(0xe1d8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_wifi_4_bar_lock</i> &#x2014; material icon named "signal wifi 4 bar lock".
  static signal_wifi_4_bar_lock = IconData.new(0xe1d9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">signal_wifi_off</i> &#x2014; material icon named "signal wifi off".
  static signal_wifi_off = IconData.new(0xe1da, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sim_card</i> &#x2014; material icon named "sim card".
  static sim_card = IconData.new(0xe32b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sim_card_alert</i> &#x2014; material icon named "sim card alert".
  static sim_card_alert = IconData.new(0xe624, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">skip_next</i> &#x2014; material icon named "skip next".
  static skip_next = IconData.new(0xe044, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">skip_previous</i> &#x2014; material icon named "skip previous".
  static skip_previous = IconData.new(0xe045, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">slideshow</i> &#x2014; material icon named "slideshow".
  static slideshow = IconData.new(0xe41b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">slow_motion_video</i> &#x2014; material icon named "slow motion video".
  static slow_motion_video = IconData.new(0xe068, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">smartphone</i> &#x2014; material icon named "smartphone".
  static smartphone = IconData.new(0xe32c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">smoke_free</i> &#x2014; material icon named "smoke free".
  static smoke_free = IconData.new(0xeb4a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">smoking_rooms</i> &#x2014; material icon named "smoking rooms".
  static smoking_rooms = IconData.new(0xeb4b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sms</i> &#x2014; material icon named "sms".
  static sms = IconData.new(0xe625, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sms_failed</i> &#x2014; material icon named "sms failed".
  static sms_failed = IconData.new(0xe626, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">snooze</i> &#x2014; material icon named "snooze".
  static snooze = IconData.new(0xe046, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sort</i> &#x2014; material icon named "sort".
  static sort = IconData.new(0xe164, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">sort_by_alpha</i> &#x2014; material icon named "sort by alpha".
  static sort_by_alpha = IconData.new(0xe053, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">spa</i> &#x2014; material icon named "spa".
  static spa = IconData.new(0xeb4c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">space_bar</i> &#x2014; material icon named "space bar".
  static space_bar = IconData.new(0xe256, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">speaker</i> &#x2014; material icon named "speaker".
  static speaker = IconData.new(0xe32d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">speaker_group</i> &#x2014; material icon named "speaker group".
  static speaker_group = IconData.new(0xe32e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">speaker_notes</i> &#x2014; material icon named "speaker notes".
  static speaker_notes = IconData.new(0xe8cd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">speaker_notes_off</i> &#x2014; material icon named "speaker notes off".
  static speaker_notes_off = IconData.new(0xe92a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">speaker_phone</i> &#x2014; material icon named "speaker phone".
  static speaker_phone = IconData.new(0xe0d2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">spellcheck</i> &#x2014; material icon named "spellcheck".
  static spellcheck = IconData.new(0xe8ce, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">star</i> &#x2014; material icon named "star".
  static star = IconData.new(0xe838, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">star_border</i> &#x2014; material icon named "star border".
  static star_border = IconData.new(0xe83a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">star_half</i> &#x2014; material icon named "star half".
  static star_half = IconData.new(0xe839, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">stars</i> &#x2014; material icon named "stars".
  static stars = IconData.new(0xe8d0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stay_current_landscape</i> &#x2014; material icon named "stay current landscape".
  static stay_current_landscape = IconData.new(0xe0d3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stay_current_portrait</i> &#x2014; material icon named "stay current portrait".
  static stay_current_portrait = IconData.new(0xe0d4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stay_primary_landscape</i> &#x2014; material icon named "stay primary landscape".
  static stay_primary_landscape = IconData.new(0xe0d5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stay_primary_portrait</i> &#x2014; material icon named "stay primary portrait".
  static stay_primary_portrait = IconData.new(0xe0d6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stop</i> &#x2014; material icon named "stop".
  static stop = IconData.new(0xe047, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">stop_screen_share</i> &#x2014; material icon named "stop screen share".
  static stop_screen_share = IconData.new(0xe0e3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">storage</i> &#x2014; material icon named "storage".
  static storage = IconData.new(0xe1db, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">store</i> &#x2014; material icon named "store".
  static store = IconData.new(0xe8d1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">store_mall_directory</i> &#x2014; material icon named "store mall directory".
  static store_mall_directory = IconData.new(0xe563, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">straighten</i> &#x2014; material icon named "straighten".
  static straighten = IconData.new(0xe41c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">streetview</i> &#x2014; material icon named "streetview".
  static streetview = IconData.new(0xe56e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">strikethrough_s</i> &#x2014; material icon named "strikethrough s".
  static strikethrough_s = IconData.new(0xe257, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">style</i> &#x2014; material icon named "style".
  static style = IconData.new(0xe41d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">subdirectory_arrow_left</i> &#x2014; material icon named "subdirectory arrow left".
  static subdirectory_arrow_left = IconData.new(0xe5d9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">subdirectory_arrow_right</i> &#x2014; material icon named "subdirectory arrow right".
  static subdirectory_arrow_right = IconData.new(0xe5da, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">subject</i> &#x2014; material icon named "subject".
  static subject = IconData.new(0xe8d2, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">subscriptions</i> &#x2014; material icon named "subscriptions".
  static subscriptions = IconData.new(0xe064, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">subtitles</i> &#x2014; material icon named "subtitles".
  static subtitles = IconData.new(0xe048, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">subway</i> &#x2014; material icon named "subway".
  static subway = IconData.new(0xe56f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">supervised_user_circle</i> &#x2014; material icon named "supervised user circle".
  static supervised_user_circle = IconData.new(0xe939, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">supervisor_account</i> &#x2014; material icon named "supervisor account".
  static supervisor_account = IconData.new(0xe8d3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">surround_sound</i> &#x2014; material icon named "surround sound".
  static surround_sound = IconData.new(0xe049, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">swap_calls</i> &#x2014; material icon named "swap calls".
  static swap_calls = IconData.new(0xe0d7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">swap_horiz</i> &#x2014; material icon named "swap horiz".
  static swap_horiz = IconData.new(0xe8d4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">swap_horizontal_circle</i> &#x2014; material icon named "swap horizontal circle".
  static swap_horizontal_circle = IconData.new(0xe933, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">swap_vert</i> &#x2014; material icon named "swap vert".
  static swap_vert = IconData.new(0xe8d5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">swap_vertical_circle</i> &#x2014; material icon named "swap vertical circle".
  static swap_vertical_circle = IconData.new(0xe8d6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">switch_camera</i> &#x2014; material icon named "switch camera".
  static switch_camera = IconData.new(0xe41e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">switch_video</i> &#x2014; material icon named "switch video".
  static switch_video = IconData.new(0xe41f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sync</i> &#x2014; material icon named "sync".
  static sync = IconData.new(0xe627, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sync_disabled</i> &#x2014; material icon named "sync disabled".
  static sync_disabled = IconData.new(0xe628, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">sync_problem</i> &#x2014; material icon named "sync problem".
  static sync_problem = IconData.new(0xe629, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">system_update</i> &#x2014; material icon named "system update".
  static system_update = IconData.new(0xe62a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">system_update_alt</i> &#x2014; material icon named "system update alt".
  static system_update_alt = IconData.new(0xe8d7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tab</i> &#x2014; material icon named "tab".
  static tab = IconData.new(0xe8d8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tab_unselected</i> &#x2014; material icon named "tab unselected".
  static tab_unselected = IconData.new(0xe8d9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">table_chart</i> &#x2014; material icon named "table chart".
  static table_chart = IconData.new(0xe265, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tablet</i> &#x2014; material icon named "tablet".
  static tablet = IconData.new(0xe32f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tablet_android</i> &#x2014; material icon named "tablet android".
  static tablet_android = IconData.new(0xe330, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tablet_mac</i> &#x2014; material icon named "tablet mac".
  static tablet_mac = IconData.new(0xe331, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tag_faces</i> &#x2014; material icon named "tag faces".
  static tag_faces = IconData.new(0xe420, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tap_and_play</i> &#x2014; material icon named "tap and play".
  static tap_and_play = IconData.new(0xe62b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">terrain</i> &#x2014; material icon named "terrain".
  static terrain = IconData.new(0xe564, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_fields</i> &#x2014; material icon named "text fields".
  static text_fields = IconData.new(0xe262, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_format</i> &#x2014; material icon named "text format".
  static text_format = IconData.new(0xe165, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotate_up</i> &#x2014; material icon named "text rotate up".
  static text_rotate_up = IconData.new(0xe93a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotate_vertical</i> &#x2014; material icon named "text rotate vertical".
  static text_rotate_vertical = IconData.new(0xe93b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotation_angledown</i> &#x2014; material icon named "text rotation angledown".
  static text_rotation_angledown = IconData.new(0xe93c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotation_angleup</i> &#x2014; material icon named "text rotation angleup".
  static text_rotation_angleup = IconData.new(0xe93d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotation_down</i> &#x2014; material icon named "text rotation down".
  static text_rotation_down = IconData.new(0xe93e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">text_rotation_none</i> &#x2014; material icon named "text rotation none".
  static text_rotation_none = IconData.new(0xe93f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">textsms</i> &#x2014; material icon named "textsms".
  static textsms = IconData.new(0xe0d8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">texture</i> &#x2014; material icon named "texture".
  static texture = IconData.new(0xe421, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">theaters</i> &#x2014; material icon named "theaters".
  static theaters = IconData.new(0xe8da, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">thumb_down</i> &#x2014; material icon named "thumb down".
  static thumb_down = IconData.new(0xe8db, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">thumb_up</i> &#x2014; material icon named "thumb up".
  static thumb_up = IconData.new(0xe8dc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">thumbs_up_down</i> &#x2014; material icon named "thumbs up down".
  static thumbs_up_down = IconData.new(0xe8dd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">time_to_leave</i> &#x2014; material icon named "time to leave".
  static time_to_leave = IconData.new(0xe62c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timelapse</i> &#x2014; material icon named "timelapse".
  static timelapse = IconData.new(0xe422, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timeline</i> &#x2014; material icon named "timeline".
  static timeline = IconData.new(0xe922, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timer</i> &#x2014; material icon named "timer".
  static timer = IconData.new(0xe425, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timer_10</i> &#x2014; material icon named "timer 10".
  static timer_10 = IconData.new(0xe423, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timer_3</i> &#x2014; material icon named "timer 3".
  static timer_3 = IconData.new(0xe424, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">timer_off</i> &#x2014; material icon named "timer off".
  static timer_off = IconData.new(0xe426, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">title</i> &#x2014; material icon named "title".
  static title = IconData.new(0xe264, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">toc</i> &#x2014; material icon named "toc".
  static toc = IconData.new(0xe8de, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">today</i> &#x2014; material icon named "today".
  static today = IconData.new(0xe8df, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">toll</i> &#x2014; material icon named "toll".
  static toll = IconData.new(0xe8e0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tonality</i> &#x2014; material icon named "tonality".
  static tonality = IconData.new(0xe427, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">touch_app</i> &#x2014; material icon named "touch app".
  static touch_app = IconData.new(0xe913, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">toys</i> &#x2014; material icon named "toys".
  static toys = IconData.new(0xe332, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">track_changes</i> &#x2014; material icon named "track changes".
  static track_changes = IconData.new(0xe8e1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">traffic</i> &#x2014; material icon named "traffic".
  static traffic = IconData.new(0xe565, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">train</i> &#x2014; material icon named "train".
  static train = IconData.new(0xe570, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tram</i> &#x2014; material icon named "tram".
  static tram = IconData.new(0xe571, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">transfer_within_a_station</i> &#x2014; material icon named "transfer within a station".
  static transfer_within_a_station = IconData.new(0xe572, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">transform</i> &#x2014; material icon named "transform".
  static transform = IconData.new(0xe428, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">transit_enterexit</i> &#x2014; material icon named "transit enterexit".
  static transit_enterexit = IconData.new(0xe579, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">translate</i> &#x2014; material icon named "translate".
  static translate = IconData.new(0xe8e2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">trending_down</i> &#x2014; material icon named "trending down".
  static trending_down = IconData.new(0xe8e3, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">trending_flat</i> &#x2014; material icon named "trending flat".
  static trending_flat = IconData.new(0xe8e4, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">trending_up</i> &#x2014; material icon named "trending up".
  static trending_up = IconData.new(0xe8e5, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">trip_origin</i> &#x2014; material icon named "trip origin".
  static trip_origin = IconData.new(0xe57b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tune</i> &#x2014; material icon named "tune".
  static tune = IconData.new(0xe429, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">turned_in</i> &#x2014; material icon named "turned in".
  static turned_in = IconData.new(0xe8e6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">turned_in_not</i> &#x2014; material icon named "turned in not".
  static turned_in_not = IconData.new(0xe8e7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">tv</i> &#x2014; material icon named "tv".
  static tv = IconData.new(0xe333, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">unarchive</i> &#x2014; material icon named "unarchive".
  static unarchive = IconData.new(0xe169, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">undo</i> &#x2014; material icon named "undo".
  static undo = IconData.new(0xe166, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">unfold_less</i> &#x2014; material icon named "unfold less".
  static unfold_less = IconData.new(0xe5d6, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">unfold_more</i> &#x2014; material icon named "unfold more".
  static unfold_more = IconData.new(0xe5d7, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">update</i> &#x2014; material icon named "update".
  static update = IconData.new(0xe923, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">usb</i> &#x2014; material icon named "usb".
  static usb = IconData.new(0xe1e0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">verified_user</i> &#x2014; material icon named "verified user".
  static verified_user = IconData.new(0xe8e8, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vertical_align_bottom</i> &#x2014; material icon named "vertical align bottom".
  static vertical_align_bottom = IconData.new(0xe258, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vertical_align_center</i> &#x2014; material icon named "vertical align center".
  static vertical_align_center = IconData.new(0xe259, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vertical_align_top</i> &#x2014; material icon named "vertical align top".
  static vertical_align_top = IconData.new(0xe25a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vibration</i> &#x2014; material icon named "vibration".
  static vibration = IconData.new(0xe62d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">video_call</i> &#x2014; material icon named "video call".
  static video_call = IconData.new(0xe070, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">video_label</i> &#x2014; material icon named "video label".
  static video_label = IconData.new(0xe071, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">video_library</i> &#x2014; material icon named "video library".
  static video_library = IconData.new(0xe04a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">videocam</i> &#x2014; material icon named "videocam".
  static videocam = IconData.new(0xe04b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">videocam_off</i> &#x2014; material icon named "videocam off".
  static videocam_off = IconData.new(0xe04c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">videogame_asset</i> &#x2014; material icon named "videogame asset".
  static videogame_asset = IconData.new(0xe338, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_agenda</i> &#x2014; material icon named "view agenda".
  static view_agenda = IconData.new(0xe8e9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_array</i> &#x2014; material icon named "view array".
  static view_array = IconData.new(0xe8ea, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_carousel</i> &#x2014; material icon named "view carousel".
  static view_carousel = IconData.new(0xe8eb, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_column</i> &#x2014; material icon named "view column".
  static view_column = IconData.new(0xe8ec, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_comfy</i> &#x2014; material icon named "view comfy".
  static view_comfy = IconData.new(0xe42a, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_compact</i> &#x2014; material icon named "view compact".
  static view_compact = IconData.new(0xe42b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_day</i> &#x2014; material icon named "view day".
  static view_day = IconData.new(0xe8ed, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_headline</i> &#x2014; material icon named "view headline".
  static view_headline = IconData.new(0xe8ee, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_list</i> &#x2014; material icon named "view list".
  static view_list = IconData.new(0xe8ef, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">view_module</i> &#x2014; material icon named "view module".
  static view_module = IconData.new(0xe8f0, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_quilt</i> &#x2014; material icon named "view quilt".
  static view_quilt = IconData.new(0xe8f1, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">view_stream</i> &#x2014; material icon named "view stream".
  static view_stream = IconData.new(0xe8f2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">view_week</i> &#x2014; material icon named "view week".
  static view_week = IconData.new(0xe8f3, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vignette</i> &#x2014; material icon named "vignette".
  static vignette = IconData.new(0xe435, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">visibility</i> &#x2014; material icon named "visibility".
  static visibility = IconData.new(0xe8f4, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">visibility_off</i> &#x2014; material icon named "visibility off".
  static visibility_off = IconData.new(0xe8f5, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">voice_chat</i> &#x2014; material icon named "voice chat".
  static voice_chat = IconData.new(0xe62e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">voicemail</i> &#x2014; material icon named "voicemail".
  static voicemail = IconData.new(0xe0d9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">volume_down</i> &#x2014; material icon named "volume down".
  static volume_down = IconData.new(0xe04d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">volume_mute</i> &#x2014; material icon named "volume mute".
  static volume_mute = IconData.new(0xe04e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">volume_off</i> &#x2014; material icon named "volume off".
  static volume_off = IconData.new(0xe04f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">volume_up</i> &#x2014; material icon named "volume up".
  static volume_up = IconData.new(0xe050, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vpn_key</i> &#x2014; material icon named "vpn key".
  static vpn_key = IconData.new(0xe0da, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">vpn_lock</i> &#x2014; material icon named "vpn lock".
  static vpn_lock = IconData.new(0xe62f, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wallpaper</i> &#x2014; material icon named "wallpaper".
  static wallpaper = IconData.new(0xe1bc, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">warning</i> &#x2014; material icon named "warning".
  static warning = IconData.new(0xe002, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">watch</i> &#x2014; material icon named "watch".
  static watch = IconData.new(0xe334, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">watch_later</i> &#x2014; material icon named "watch later".
  static watch_later = IconData.new(0xe924, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wb_auto</i> &#x2014; material icon named "wb auto".
  static wb_auto = IconData.new(0xe42c, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wb_cloudy</i> &#x2014; material icon named "wb cloudy".
  static wb_cloudy = IconData.new(0xe42d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wb_incandescent</i> &#x2014; material icon named "wb incandescent".
  static wb_incandescent = IconData.new(0xe42e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wb_iridescent</i> &#x2014; material icon named "wb iridescent".
  static wb_iridescent = IconData.new(0xe436, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wb_sunny</i> &#x2014; material icon named "wb sunny".
  static wb_sunny = IconData.new(0xe430, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wc</i> &#x2014; material icon named "wc".
  static wc = IconData.new(0xe63d, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">web</i> &#x2014; material icon named "web".
  static web = IconData.new(0xe051, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">web_asset</i> &#x2014; material icon named "web asset".
  static web_asset = IconData.new(0xe069, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">weekend</i> &#x2014; material icon named "weekend".
  static weekend = IconData.new(0xe16b, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">whatshot</i> &#x2014; material icon named "whatshot".
  static whatshot = IconData.new(0xe80e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">widgets</i> &#x2014; material icon named "widgets".
  static widgets = IconData.new(0xe1bd, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wifi</i> &#x2014; material icon named "wifi".
  static wifi = IconData.new(0xe63e, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wifi_lock</i> &#x2014; material icon named "wifi lock".
  static wifi_lock = IconData.new(0xe1e1, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wifi_tethering</i> &#x2014; material icon named "wifi tethering".
  static wifi_tethering = IconData.new(0xe1e2, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">work</i> &#x2014; material icon named "work".
  static work = IconData.new(0xe8f9, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">wrap_text</i> &#x2014; material icon named "wrap text".
  static wrap_text = IconData.new(0xe25b, {fontFamily:'MaterialIcons',matchTextDirection:true});

  /// <i class="material-icons md-36">youtube_searched_for</i> &#x2014; material icon named "youtube searched for".
  static youtube_searched_for = IconData.new(0xe8fa, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">zoom_in</i> &#x2014; material icon named "zoom in".
  static zoom_in = IconData.new(0xe8ff, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">zoom_out</i> &#x2014; material icon named "zoom out".
  static zoom_out = IconData.new(0xe900, {fontFamily:'MaterialIcons'});

  /// <i class="material-icons md-36">zoom_out_map</i> &#x2014; material icon named "zoom out map".
  static zoom_out_map = IconData.new(0xe56b, {fontFamily:'MaterialIcons'});
  // END GENERATED
}
//#endregion


//#region ******* CupertinoIcons ********
export class CupertinoIcons extends IconData{

  /// A thin left chevron.
  static left_chevron = IconData.new(0xf3d2,  {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons", matchTextDirection:true});

  /// A thin right chevron.
  static right_chevron = IconData.new(0xf3d3,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons", matchTextDirection:true});

  /// iOS style share icon with an arrow pointing up from a box. This icon is not filled in.
  static share = IconData.new(0xf4ca,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// iOS style share icon with an arrow pointing up from a box. This icon is filled in.
  static share_solid = IconData.new(0xf4cb,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A book silhouette spread open. This icon is not filled in.
  static book = IconData.new(0xf3e7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A book silhouette spread open. This icon is filled in.
  static book_solid = IconData.new(0xf3e8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A book silhouette spread open containing a bookmark in the upper right. This icon is not filled in.
  static bookmark = IconData.new(0xf3e9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A book silhouette spread open containing a bookmark in the upper right. This icon is filled in.
  static bookmark_solid = IconData.new(0xf3ea,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A letter 'i' in a circle.
  static info = IconData.new(0xf44c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A curved up and left pointing arrow.
  static reply = IconData.new(0xf4c6,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A chat bubble.
  static conversation_bubble = IconData.new(0xf3fb,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A person's silhouette in a circle.
  static profile_circled = IconData.new(0xf419,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A '+' sign in a circle.
  static plus_circled = IconData.new(0xf48a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A '-' sign in a circle.
  static minus_circled = IconData.new(0xf463,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A right facing flag and pole outline.
  static flag = IconData.new(0xf42c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A magnifier loop outline.
  static search = IconData.new(0xf4a5,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A checkmark.
  static check_mark = IconData.new(0xf3fd,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A checkmark in a circle. The circle is not filled in.
  static check_mark_circled = IconData.new(0xf3fe,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A checkmark in a circle. The circle is filled in.
  static check_mark_circled_solid = IconData.new(0xf3ff,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An empty circle (a ring).  An un-selected radio button.
  static circle = IconData.new(0xf401,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled circle.  The circle is surrounded by a ring.  A selected radio button.
  static circle_filled = IconData.new(0xf400,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A thicker left chevron used in iOS for the navigation bar back button.
  static back = IconData.new(0xf3cf,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons", matchTextDirection:true});

  /// A thicker right chevron that's the reverse of [back].
  static forward = IconData.new(0xf3d1,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons", matchTextDirection:true});

  /// Outline of a simple front-facing house.
  static home = IconData.new(0xf447,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A right-facing shopping cart outline.
  static shopping_cart = IconData.new(0xf3f7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Three solid dots.
  static ellipsis = IconData.new(0xf46a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A phone handset outline.
  static phone = IconData.new(0xf4b8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A phone handset.
  static phone_solid = IconData.new(0xf4b9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A solid down arrow.
  static down_arrow = IconData.new(0xf35d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A solid up arrow.
  static up_arrow = IconData.new(0xf366,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A charging battery.
  static battery_charging = IconData.new(0xf111,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An empty battery.
  static battery_empty = IconData.new(0xf112,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A full battery.
  static battery_full = IconData.new(0xf113,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A 75% charged battery.
  static battery_75_percent = IconData.new(0xf114,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A 25% charged battery.
  static battery_25_percent = IconData.new(0xf115,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// The Bluetooth logo.
  static bluetooth = IconData.new(0xf116,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A restart arrow, pointing downwards.
  static restart = IconData.new(0xf21c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two curved up and left pointing arrows.
  static reply_all = IconData.new(0xf21d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A curved up and left pointing arrow.
  static reply_thick_solid = IconData.new(0xf21e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// iOS style share icon with an arrow pointing upwards to the right from a box.
  static share_up = IconData.new(0xf220,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two thin right-facing intertwined arrows.
  static shuffle = IconData.new(0xf4a9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two medium thickness right-facing intertwined arrows.
  static shuffle_medium = IconData.new(0xf4a8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two thick right-facing intertwined arrows.
  static shuffle_thick = IconData.new(0xf221,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera for still photographs. This icon is filled in.
  static photo_camera = IconData.new(0xf3f5,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera for still photographs. This icon is not filled in.
  static photo_camera_solid = IconData.new(0xf3f6,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera for moving pictures. This icon is not filled in.
  static video_camera = IconData.new(0xf4cc,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera for moving pictures. This icon is filled in.
  static video_camera_solid = IconData.new(0xf4cd,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera containing two circular arrows pointing at each other, which indicate switching. This icon is not filled in.
  static switch_camera = IconData.new(0xf49e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A camera containing two circular arrows pointing at each other, which indicate switching. This icon is filled in.
  static switch_camera_solid = IconData.new(0xf49f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A collection of folders, which store collections of files, i.e. an album. This icon is not filled in.
  static collections = IconData.new(0xf3c9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A collection of folders, which store collections of files, i.e. an album. This icon is filled in.
  static collections_solid = IconData.new(0xf3ca,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single folder, which stores multiple files. This icon is not filled in.
  static folder = IconData.new(0xf434,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single folder, which stores multiple files. This icon is filled in.
  static folder_solid = IconData.new(0xf435,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single folder that indicates being opened. A folder like this typically stores multiple files.
  static folder_open = IconData.new(0xf38a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A trash bin for removing items. This icon is not filled in.
  static delete = IconData.new(0xf4c4,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A trash bin for removing items. This icon is filled in.
  static delete_solid = IconData.new(0xf4c5,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A trash bin with minimal detail for removing items.
  static delete_simple = IconData.new(0xf37f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A simple pen.
  static pen = IconData.new(0xf2bf,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A simple pencil.
  static pencil = IconData.new(0xf37e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A box for writing and a pen on top (that indicates the writing). This icon is not filled in.
  static create = IconData.new(0xf417,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A box for writing and a pen on top (that indicates the writing). This icon is filled in.
  static create_solid = IconData.new(0xf417,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start.
  static refresh = IconData.new(0xf49a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start surrounded by a circle. This is icon is not filled in.
  static refresh_circled = IconData.new(0xf49b,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start surrounded by a circle. This is icon is filled in.
  static refresh_circled_solid = IconData.new(0xf49c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start.
  static refresh_thin = IconData.new(0xf49d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start.
  static refresh_thick = IconData.new(0xf3a8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An arrow on a circular path with its end pointing at its start.
  static refresh_bold = IconData.new(0xf21c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cross of two diagonal lines from edge to edge crossing in an angle of 90 degrees, which is used for dismissal.
  static clear_thick = IconData.new(0xf2d7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cross of two diagonal lines from edge to edge crossing in an angle of 90 degrees, which is used for dismissal, used as a blank space in a circle.
  static clear_thick_circled = IconData.new(0xf36e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cross of two diagonal lines from edge to edge crossing in an angle of 90 degrees, which is used for dismissal.
  static clear = IconData.new(0xf404,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cross of two diagonal lines from edge to edge crossing in an angle of 90 degrees, which is used for dismissal, surrounded by circle. This icon is not filled in.
  static clear_circled = IconData.new(0xf405,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cross of two diagonal lines from edge to edge crossing in an angle of 90 degrees, which is used for dismissal, used as a blank space in a circle. This icon is filled in.
  static clear_circled_solid = IconData.new(0xf406,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two straight lines, one horizontal and one vertical, meeting in the middle, which is the equivalent of a plus sign.
  static add = IconData.new(0xf489,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two straight lines, one horizontal and one vertical, meeting in the middle, which is the equivalent of a plus sign, surrounded by a circle. This icon is not filled in.
  static add_circled = IconData.new(0xf48a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two straight lines, one horizontal and one vertical, meeting in the middle, which is the equivalent of a plus sign, surrounded by a circle. This icon is not filled in.
  static add_circled_solid = IconData.new(0xf48b,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A gear with eight cogs. This icon is not filled in.
  static gear = IconData.new(0xf43c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A gear with eight cogs. This icon is filled in.
  static gear_solid = IconData.new(0xf43d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A gear with six cogs.
  static gear_big = IconData.new(0xf2f7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cogwheel with many cogs and decoration in the middle. This icon is not filled in.
  static settings = IconData.new(0xf411,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A cogwheel with many cogs and decoration in the middle. This icon is filled in.
  static settings_solid = IconData.new(0xf412,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A symbol representing a solid single musical note.
  static music_note = IconData.new(0xf46b,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A symbol representing 2 connected musical notes.
  static double_music_note = IconData.new(0xf46c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A triangle facing to the right. This icon is not filled in.
  static play_arrow = IconData.new(0xf487,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A triangle facing to the right. This icon is filled in.
  static play_arrow_solid = IconData.new(0xf488,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two vertical rectangles. This icon is not filled in.
  static pause = IconData.new(0xf477,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Two vertical rectangles. This icon is filled in.
  static pause_solid = IconData.new(0xf478,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// The infinity symbol.
  static loop = IconData.new(0xf449,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// The infinity symbol.
  static loop_thick = IconData.new(0xf44a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A speaker with a single small sound wave.
  static volume_down = IconData.new(0xf3b7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A speaker symbol.
  static volume_mute = IconData.new(0xf3b8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A speaker with a small and a large sound wave and a diagonal line crossing the whole icon.
  static volume_off = IconData.new(0xf3b9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A speaker with a small and a large sound wave.
  static volume_up = IconData.new(0xf3ba,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// All four corners of a square facing inwards.
  static fullscreen = IconData.new(0xf386,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// All four corners of a square facing outwards.
  static fullscreen_exit = IconData.new(0xf37d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in microphone with a diagonal line crossing it.
  static mic_off = IconData.new(0xf45f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A microphone.
  static mic = IconData.new(0xf460,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in microphone.
  static mic_solid = IconData.new(0xf461,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A circle with a dotted clock face inside with hands showing 10:30.
  static clock = IconData.new(0xf4be,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in circle with a dotted clock face inside with hands showing 10:30.
  static clock_solid = IconData.new(0xf4bf,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A circle with with a 90 degree angle shape in the center, resembling a clock with hands showing 09:00.
  static time = IconData.new(0xf402,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in circle with with a 90 degree angle shape in the center, resembling a clock with hands showing 09:00.
  static time_solid = IconData.new(0xf403,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An unlocked padlock.
  static padlock = IconData.new(0xf4c8,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An unlocked padlock.
  static padlock_solid = IconData.new(0xf4c9,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An open eye.
  static eye = IconData.new(0xf424,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An open eye.
  static eye_solid = IconData.new(0xf425,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single person. This icon is not filled in.
  static person = IconData.new(0xf47d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single person. This icon is filled in.
  static person_solid = IconData.new(0xf47e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single person with a plus sign next to it. This icon is not filled in.
  static person_add = IconData.new(0xf47f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A single person with a plus sign next to it. This icon is filled in.
  static person_add_solid = IconData.new(0xf480,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A group of three people. This icon is not filled in.
  static group = IconData.new(0xf47b,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A group of three people. This icon is filled in.
  static group_solid = IconData.new(0xf47c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Outline of a closed mail envelope.
  static mail = IconData.new(0xf422,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A closed mail envelope. This icon is filled in.
  static mail_solid = IconData.new(0xf423,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Outline of a location pin.
  static location = IconData.new(0xf455,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A location pin. This icon is filled in.
  static location_solid = IconData.new(0xf456,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Outline of a sticker tag.
  static tag = IconData.new(0xf48c,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A sticker tag. This icon is filled in.
  static tag_solid = IconData.new(0xf48d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// Outlines of 2 overlapping sticker tags.
  static tags = IconData.new(0xf48e,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// 2 overlapping sticker tags. This icon is filled in.
  static tags_solid = IconData.new(0xf48f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in bus.
  static bus = IconData.new(0xf36d,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in car.
  static car = IconData.new(0xf36f,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in detailed, realistic car.
  static car_detailed = IconData.new(0xf2c1,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in train with a window divided in half and two headlights.
  static train_style_one = IconData.new(0xf3af,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in train with a window and a single, centered headlight.
  static train_style_two = IconData.new(0xf3b4,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined paw.
  static paw = IconData.new(0xf479,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in paw.
  static paw_solid = IconData.new(0xf47a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined game controller.
  static game_controller = IconData.new(0xf43a,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in game controller.
  static game_controller_solid = IconData.new(0xf43b,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined lab flask.
  static lab_flask = IconData.new(0xf430,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in lab flask.
  static lab_flask_solid = IconData.new(0xf431,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined heart shape. Can be used to indicate like or favorite states.
  static heart = IconData.new(0xf442,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled heart shape. Can be used to indicate like or favorite states.
  static heart_solid = IconData.new(0xf443,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined bell. Can be used to represent notifications.
  static bell = IconData.new(0xf3e1,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled bell. Can be used represent notifications.
  static bell_solid = IconData.new(0xf3e2,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// An outlined folded newspaper icon.
  static news = IconData.new(0xf471,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled folded newspaper icon.
  static news_solid = IconData.new(0xf472,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A outlined brightness icon.
  static brightness = IconData.new(0xf4B6,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});

  /// A filled in brightness icon.
  static brightness_solid = IconData.new(0xf4B7,   {fontFamily:"CupertinoIcons", fontPackage:"cupertino_icons"});
}
//#endregion


//#region ******* Material widgets ********

//#region ------- A -------

//****** AbsorbPointer ******
interface AbsorbPointerConfig {
  key?:Key;
  child?:FlutterWidget;
  absorbing?:boolean;
  ignoringSemantics?:boolean;
}
export class AbsorbPointer extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  absorbing?:boolean;
  ignoringSemantics?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        absorbing?:boolean, 
        ignoringSemantics?:boolean, 
      }
   */
  static new(config?: AbsorbPointerConfig) {
    var v = new AbsorbPointer();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.absorbing = config.absorbing;
      v.ignoringSemantics = config.ignoringSemantics;
    }
    return v;
  }
}

//****** TODO AnimationController ******
interface AnimationControllerConfig {
  value?:number;
  duration?:Duration;
  debugLabel?:string; 
  lowerBound?:number;
  upperBound?:number;
  animationBehavior?:AnimationBehavior;
  vsync?:any;
}
export class AnimationController extends FlutterWidget {
  value?:number;
  duration?:Duration;
  debugLabel?:string; 
  lowerBound?:number;
  upperBound?:number;
  animationBehavior?:AnimationBehavior;
  vsync?:any;
  /**
   * @param config config: 
      {
        value?:number,
        duration?:Duration, 
        debugLabel?:string;, 
        lowerBound?:number, 
        upperBound?:number,
        animationBehavior?:AnimationBehavior,
        vsync?:any,
      }
   */
  static new(config: AnimationControllerConfig) {
    var v = new AnimationController();
    v.createMirrorID();
    if(config!=null && config!=undefined){
      v.value = config.value;
      v.duration = config.duration;
      v.debugLabel = config.debugLabel;
      v.lowerBound = config.lowerBound;
      v.upperBound = config.upperBound;
      v.animationBehavior = config.animationBehavior;
      v.vsync = config.vsync;
    }

    return v;
  }


  ///TODO:
  dispose() { }
  /*
  forward(from) {
    var argument = new FlutterCallArgs({
      mirrorID: this.mirrorID,
      className: "AnimationController",
      funcName: "forward",
      args: {
        from: from
      }
    });
    invokeFlutterFunction(argument);
  }

  reverse(from) {
    var argument = new FlutterCallArgs({
      mirrorID: this.mirrorID,
      className: "AnimationController",
      funcName: "reverse",
      args: {
        from: from
      }
    });
    invokeFlutterFunction(argument);
  }

  repeat(min, max, period) {
    var argument = new FlutterCallArgs({
      mirrorID: this.mirrorID,
      className: "AnimationController",
      funcName: "repeat",
      args: {
        min: min,
        max: max,
        period: period
      }
    });
    invokeFlutterFunction(argument);
  }

  drive(animatable) {
    var argument = new FlutterCallArgs({
      mirrorID: this.mirrorID,
      className: "AnimationController",
      funcName: "drive",
      args: {
        animatable: animatable
      }
    });
    invokeFlutterFunction(argument);
  }*/
}


//****** TODO Animation ******
export class Animation extends FlutterWidget {
  tween?:Tween;
  controller?:AnimationController;
  statusListenerList?:any;
  listenerList?:any;

  static new(tween?:Tween, controller?:AnimationController) {
    var v = new Animation();
    v.createMirrorID();

    v.tween = tween;
    v.controller = controller;
    v.statusListenerList = [];
    v.listenerList = [];
    return v;
  }

  statusListenerCallback(status:any) {
    for (let funcKey in this.statusListenerList) {
      this.statusListenerList[funcKey](status);
    }
  }

  listenerCallback(status:any) {
    for (let funcKey in this.listenerList) {
      this.listenerList[funcKey](status);
    }
  }

  value() {
    return "animation.value";
  }

  addListener(callback:any) {
    this.listenerList.push(callback);
  }

  removeListener(callback:any) {
    const index = this.listenerList.indexOf(callback);
    this.listenerList.splice(index);
  }

  addStatusListener(callback:any) {
    this.statusListenerList.push(callback);
  }

  removeStatusListener(callback:any) {
    let index = this.statusListenerList.indexOf(callback);
    this.statusListenerList.splice(index);
  }
}

//****** TODO AboutListTile ******
interface AboutListTileConfig {
  key?:Key;
  child?:FlutterWidget;
  icon?:FlutterWidget;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  dense?:boolean;
  applicationIcon?:FlutterWidget;
  aboutBoxChildren?:Array<FlutterWidget>;
}
export class AboutListTile extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  icon?:FlutterWidget;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  dense?:boolean;
  applicationIcon?:FlutterWidget;
  aboutBoxChildren?:Array<FlutterWidget>;
    
  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        icon?:FlutterWidget, 
        applicationName?:string, 
        applicationLegalese?:string, 
        applicationVersion?:string, 
        dense?:boolean, 
        applicationIcon?:FlutterWidget, 
        aboutBoxChildren?:Array<FlutterWidget>, 
      }
   */
  static new(config: AboutListTileConfig){
      var v = new AboutListTile();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.child = config.child;
        v.icon = config.icon;
        v.applicationIcon = config.applicationIcon;
        v.applicationName = config.applicationName;
        v.applicationLegalese = config.applicationLegalese;
        v.applicationVersion = config.applicationVersion;
        v.dense = config.dense;
        v.aboutBoxChildren = config.aboutBoxChildren;
      }
      return v;
  }
}

//****** TODO AboutDialog ******
interface AboutDialogConfig {
  key?:Key;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  applicationIcon?:FlutterWidget;
  children?:Array<FlutterWidget>;
}
export class AboutDialog extends FlutterWidget {
  key?:Key;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  applicationIcon?:FlutterWidget;
  children?:Array<FlutterWidget>;
    
  /**
   * @param config config: 
      {
        key?:Key, 
        applicationName?:string, 
        applicationLegalese?:string, 
        applicationVersion?:string, 
        applicationIcon?:FlutterWidget, 
        children?:Array<FlutterWidget>, 
      }
   */
  static new(config: AboutDialogConfig){
      var v = new AboutDialog();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.applicationIcon = config.applicationIcon;
        v.applicationName = config.applicationName;
        v.applicationLegalese = config.applicationLegalese;
        v.applicationVersion = config.applicationVersion;
        v.children = config.children;
      }
      return v;
  }
}


//****** TODO AppBar ******
interface AppBarConfig {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  title?:FlutterWidget;  
  actions?:Array<FlutterWidget>;  
  flexibleSpace?:FlutterWidget;
  bottom?:FlutterWidget;
  elevation?:number;
  shadowColor?:Color;
  shape?:any;
  backgroundColor?:Color;
  brightness?:Brightness;
  primary?:boolean;
  centerTitle?:boolean;
  excludeHeaderSemantics?:boolean;
  titleSpacing?:number;
  toolbarOpacity?:number;
  bottomOpacity?:number;
  toolbarHeight?:number;
}
export class AppBar extends FlutterWidget {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  title?:FlutterWidget;  
  actions?:Array<FlutterWidget>;  
  flexibleSpace?:FlutterWidget;
  bottom?:FlutterWidget;
  elevation?:number;
  shadowColor?:Color;
  shape?:any;
  backgroundColor?:Color;
  brightness?:Brightness;
  primary?:boolean;
  centerTitle?:boolean;
  excludeHeaderSemantics?:boolean;
  titleSpacing?:number;
  toolbarOpacity?:number;
  bottomOpacity?:number;
  toolbarHeight?:number;
    
  /**
   * @param config config: 
      {
        key?:Key, 
        leading?:FlutterWidget, 
        automaticallyImplyLeading?:boolean, 
        title?:FlutterWidget, 
        actions?:Array<FlutterWidget>, 
        flexibleSpace?:FlutterWidget, 
        bottom?:FlutterWidget, 
        elevation?:number, 
        shadowColor?:Color, 
        shape?:any, 
        backgroundColor?:Color,
        brightness?:Brightness,
        primary?:boolean, 
        centerTitle?:boolean, 
        excludeHeaderSemantics?:boolean, 
        titleSpacing?:number, 
        toolbarOpacity?:number, 
        bottomOpacity?:number, 
        toolbarHeight?:number
      }
   */
  static new(config: AppBarConfig){
      var v = new AppBar();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.leading = config.leading;
        v.automaticallyImplyLeading = config.automaticallyImplyLeading;
        v.title = config.title;
        v.actions = config.actions;
        v.flexibleSpace = config.flexibleSpace;
        v.bottom = config.bottom;
        v.elevation = config.elevation;
        v.shadowColor = config.shadowColor;
        v.shape = config.shape;
        v.backgroundColor = config.backgroundColor;
        v.brightness = config.brightness;
        v.primary = config.primary;
        v.centerTitle = config.centerTitle;
        v.excludeHeaderSemantics = config.excludeHeaderSemantics;
        v.titleSpacing = config.titleSpacing;
        v.toolbarOpacity = config.toolbarOpacity;
        v.bottomOpacity = config.bottomOpacity;
        v.toolbarHeight = config.toolbarHeight;
      }
      return v;
  }
}

//****** Align ******
interface AlignConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  widthFactor?:number;
  heightFactor?:number;
}
export class Align extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  widthFactor?:number;
  heightFactor?:number;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget,
      alignment?:Alignment, 
      widthFactor?:number, 
      heightFactor?:number,
    }
   */
  static new(config: AlignConfig) {
    var v = new Align();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.widthFactor = config.widthFactor;
      v.heightFactor = config.heightFactor;
      v.child = config.child;
    }
    return v;
  }
}

//****** AspectRatio ******
interface AspectRatioConfig {
  child?:FlutterWidget;
  aspectRatio?:number;
  key?:Key;
}
export class AspectRatio extends FlutterWidget {
  child?:FlutterWidget;
  aspectRatio?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        aspectRatio?:number,
      }
   */
  static new(config: AspectRatioConfig) {
    var v = new AspectRatio();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.aspectRatio = config.aspectRatio;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO AnnotatedRegion ******
interface AnnotatedRegionConfig {
  key?:Key;
  child?:FlutterWidget;
  value?:number;
  sized?:boolean;
}
export class AnnotatedRegion extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  value?:number;
  sized?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        value?:number, 
        sized?:boolean,
      }
   */
  static new(config: AnnotatedRegionConfig){
    var v = new AnnotatedRegion();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.value = config.value;
      v.sized = config.sized;
    }
    return v ;
  }
}

//****** TODO AnimatedCrossFade ******
interface AnimatedCrossFadeConfig {
  key?:Key;
  firstChild?:FlutterWidget;
  secondChild?:FlutterWidget;
  firstCurve?:Curve;
  secondCurve?:Curve;
  sizeCurve?:Curve;
  alignment?:Alignment;
  crossFadeState?:CrossFadeState;
  duration?:Duration;
  reverseDuration?:Duration;
  layoutBuilder?:any;
}
export class AnimatedCrossFade extends FlutterWidget {
  key?:Key;
  firstChild?:FlutterWidget;
  secondChild?:FlutterWidget;
  firstCurve?:Curve;
  secondCurve?:Curve;
  sizeCurve?:Curve;
  alignment?:Alignment;
  crossFadeState?:CrossFadeState;
  duration?:Duration;
  reverseDuration?:Duration;
  layoutBuilder?:any;
  /**
   * @param config config: 
      {
        key?:Key, 
        firstChild?:FlutterWidget, 
        secondChild?:FlutterWidget, 
        firstCurve?:Curve, 
        secondCurve?:Curve,
        sizeCurve?:Curve, 
        alignment?:Alignment, 
        crossFadeState?:CrossFadeState, 
        duration?:Duration, 
        reverseDuration?:Duration, 
        layoutBuilder?:any
      }
   */
  static new(config: AnimatedCrossFadeConfig) {
    var v = new AnimatedCrossFade();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.firstChild = config.firstChild;
      v.secondChild = config.secondChild;
      v.firstCurve = config.firstCurve;
      v.secondCurve = config.secondCurve;
      v.sizeCurve = config.sizeCurve;
      v.alignment = config.alignment;
      v.crossFadeState = config.crossFadeState;
      v.duration = config.duration;
      v.reverseDuration = config.reverseDuration;
      v.layoutBuilder = config.layoutBuilder;
    }
    return v;
  };
}

//****** TODO AnimatedOpacity ******
interface AnimatedOpacityConfig {
  key?:Key;
  child?:FlutterWidget;
  opacity?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
  alwaysIncludeSemantics?:boolean;
}
export class AnimatedOpacity extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  opacity?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
  alwaysIncludeSemantics?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        opacity?:number, 
        curve?:Curve, 
        duration?:Duration, 
        onEnd?:VoidCallback, 
        alwaysIncludeSemantics?:boolean
      }
   */
  static new(config: AnimatedOpacityConfig) {
    var v = new AnimatedOpacity();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.opacity = config.opacity;
      v.curve = config.curve;
      v.duration = config.duration;
      v.onEnd = config.onEnd;
      v.alwaysIncludeSemantics = config.alwaysIncludeSemantics;
    }
    return v;
  };
}

//****** TODO AnimatedBuilder ******
interface AnimatedBuilderConfig {
  key?:Key;
  animation?:Animation;
  builder?:any;
  child?:FlutterWidget;
  widget?:FlutterWidget;
}
export class AnimatedBuilder extends FlutterWidget {
  key?:Key;
  animation?:Animation;
  builder?:any;
  child?:FlutterWidget;
  widget?:FlutterWidget;

  /**
   * @param config config: 
      {
        key?:Key, 
        animation?:Animation, 
        builder?:any, 
        child?:FlutterWidget, 
        widget?:FlutterWidget
      }
   */
  static new(config: AnimatedBuilderConfig) {
    var v = new AnimatedBuilder();
    v.key = config.key;
    v.animation = config.animation;
    v.builder = config.builder;
    v.child = config.child;
    v.widget = config.widget;
    return v;
  }
}

//****** TODO AnimatedContainer ******
interface AnimatedContainerConfig {
  key?:Key;
  alignment?:Alignment;
  margin?:EdgeInsets;
  padding?:EdgeInsets;
  child?:FlutterWidget;
  color?:Color;
  decoration?:BoxDecoration;
  foregroundDecoration?:BoxDecoration;
  width?:number;
  height?:number;
  constraints?:BoxConstraints;
  transform?:Matrix4;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
}
export class AnimatedContainer extends FlutterWidget {
  key?:Key;
  alignment?:Alignment;
  margin?:EdgeInsets;
  padding?:EdgeInsets;
  child?:FlutterWidget;
  color?:Color;
  decoration?:BoxDecoration;
  foregroundDecoration?:BoxDecoration;
  width?:number;
  height?:number;
  constraints?:BoxConstraints;
  transform?:Matrix4;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;

  /**
   * @param config config: 
      {
        key?:Key, 
        alignment?:Alignment, 
        margin?:EdgeInsets, 
        padding?:EdgeInsets, 
        child?:FlutterWidget, 
        color?:Color, 
        decoration?:BoxDecoration, 
        foregroundDecoration?:BoxDecoration, 
        width?:number, 
        height?:number, 
        constraints?:BoxConstraints, 
        transform?:Matrix4, 
        curve?:Curve, 
        duration?:Duration, 
        onEnd?:VoidCallback,
      }
   */
  static new(config: AnimatedContainerConfig) {
    var v = new AnimatedContainer();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.margin = config.margin;
      v.padding = config.padding;
      v.child = config.child;
      v.color = config.color;
      v.decoration= config.decoration;
      v.foregroundDecoration = config.foregroundDecoration;
      v.width = config.width;
      v.height = config.height;
      v.constraints = config.constraints;
      v.transform = config.transform;
      v.curve = config.curve;
      v.duration = config.duration;
      v.onEnd = config.onEnd;
    }
    return v;
  }

}

//****** TODO AnimatedPhysicalModel ******
interface AnimatedPhysicalModelConfig {
  key?:Key;
  child?:FlutterWidget;
  shape?:any;
  clipBehavior?:Clip;
  borderRadius?:BorderRadius;
  elevation?:number;
  color?:Color;
  animateColor?:boolean;
  shadowColor?:Color;
  animateShadowColor?:boolean;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
}
export class AnimatedPhysicalModel extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  shape?:any;
  clipBehavior?:Clip;
  borderRadius?:BorderRadius;
  elevation?:number;
  color?:Color;
  animateColor?:boolean;
  shadowColor?:Color;
  animateShadowColor?:boolean;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        shape?:any, 
        clipBehavior?:Clip, 
        borderRadius?:BorderRadius, 
        elevation?:number,
        color?:Color, 
        animateColor?:boolean, 
        shadowColor?:Color, 
        animateShadowColor?:boolean, 
        curve?:Curve, 
        duration?:Duration, 
        onEnd?:VoidCallback
      }
   */
  static new(config: AnimatedPhysicalModelConfig) {
    var v = new AnimatedPhysicalModel();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.borderRadius = config.borderRadius;
      v.elevation = config.elevation;
      v.color = config.color;
      v.animateColor = v.animateColor;
      v.animateShadowColor = config.animateShadowColor;
      v.shadowColor = config.shadowColor;
      v.curve = config.curve;
      v.duration = config.duration;
      v.onEnd = config.onEnd;
    }
    return v;
  }
}

//****** TODO AnimatedPositioned ******
interface AnimatedPositionedConfig {
  key?:Key;
  child?:FlutterWidget;
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  width?:number;
  height?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
}
export class AnimatedPositioned extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  left?:number;
  top?:number;
  right?:number;
  bottom?:number;
  width?:number;
  height?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        left?:number, 
        top?:number, 
        right?:number, 
        bottom?:number,
        width?:number, 
        height?:number, 
        curve?:Curve, 
        duration?:Duration, 
        onEnd?:VoidCallback,
      }
   */
  static new(config: AnimatedPositionedConfig) {
    var v = new AnimatedPositioned();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.width = config.width;
      v.curve = config.curve;
      v.duration = config.duration;
      v.onEnd = config.onEnd;
    }
    return v;
  }
}

//****** TODO AnimatedSize ******
interface AnimatedSizeConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  curve?:Curve;
  duration?:Duration;
  reverseDuration?:Duration;
  vsync?:any;
}
export class AnimatedSize extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  curve?:Curve;
  duration?:Duration;
  reverseDuration?:Duration;
  vsync?:any;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        alignment?:Alignment, 
        curve?:Curve, 
        duration?:Duration, 
        reverseDuration?:Duration, 
        vsync?:any
      }
   */
  static new(config: AnimatedSizeConfig) {
    var v = new AnimatedSize();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.alignment = config.alignment;
      v.curve = config.curve;
      v.duration = config.duration;
      v.reverseDuration = config.reverseDuration;
      v.vsync = config.vsync;
    }
    return v;
  }
}

//****** TODO AnimatedDefaultTextStyle ******
interface AnimatedDefaultTextStyleConfig {
  key?:Key;
  child?:FlutterWidget;
  style?:TextStyle;
  textAlign?:TextAlign;
  softWrap?:boolean;
  overflow?:TextOverflow;
  maxLines?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
}
export class AnimatedDefaultTextStyle extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  style?:TextStyle;
  textAlign?:TextAlign;
  softWrap?:boolean;
  overflow?:TextOverflow;
  maxLines?:number;
  curve?:Curve;
  duration?:Duration;
  onEnd?:VoidCallback;
  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        style?:TextStyle, 
        textAlign?:TextAlign, 
        softWrap?:boolean, 
        overflow?:TextOverflow,
        maxLines?:number, 
        curve?:Curve, 
        duration?:Duration, 
        onEnd?:VoidCallback
      }
   */
  static new(config: AnimatedDefaultTextStyleConfig) {
    var v = new AnimatedDefaultTextStyle();
    if(config!=null && config!=undefined){
      v.key = config.key
      v.child = config.child;
      v.style = config.style;
      v.softWrap = config.softWrap;
      v.textAlign = config.textAlign;
      v.softWrap = config.softWrap;
      v.maxLines = config.maxLines;
      v.curve = config.curve;
      v.duration = config.duration;
      v.onEnd =config.onEnd;
    }
    return v;
  }
}

//#endregion

//#region ------- B -------
//****** BottomNavigationBarItem ******
interface BottomNavigationBarItemConfig {
  icon:FlutterWidget;
  title?:FlutterWidget;
  activeIcon?:FlutterWidget;
  backgroundColor?:Color;
}
export class BottomNavigationBarItem extends FlutterWidget {
  icon?:FlutterWidget;
  title?:FlutterWidget;
  activeIcon?:FlutterWidget;
  backgroundColor?:Color;

  /**
   * @param config config: 
      {
        icon:FlutterWidget, 
        title?:FlutterWidget,
        activeIcon?:FlutterWidget, 
        backgroundColor?:Color
      }
   */
  static new (config: BottomNavigationBarItemConfig) {
    var v = new BottomNavigationBarItem();
    if(config!=null && config!=undefined){
      v.icon = config.icon;
      v.title = config.title;
      v.activeIcon = config.activeIcon;
      v.backgroundColor = config.backgroundColor;
    }
    return v;
  }
}

//****** Banner ******
interface BannerConfig {
  key?:Key;
  child?:FlutterWidget;
  message:string;
  textDirection?:TextDirection;
  location:BannerLocation;
  layoutDirection?:TextDirection;
  color?:Color;
  textStyle?:TextStyle;
}
export class Banner extends FlutterWidget  {
  key?:Key;
  child?:FlutterWidget;
  message?:string;
  textDirection?:TextDirection;
  location?:BannerLocation;
  layoutDirection?:TextDirection;
  color?:Color;
  textStyle?:TextStyle;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        message:string, 
        textDirection?:TextDirection, 
        location:BannerLocation, 
        layoutDirection?:TextDirection, 
        color?:Color, 
        textStyle?:TextStyle, 
      }
   */
  static new(config: BannerConfig) {
    var v = new Banner();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.message = config.message;
      v.textDirection = config.textDirection;
      v.location = config.location;
      v.layoutDirection = config.layoutDirection;
      v.color = config.color;
      v.textStyle =config.textStyle;
    }
    return v;
  }
}

//****** Baseline ******
interface BaselineConfig {
  child?:FlutterWidget;
  baseline:number;
  baselineType:TextBaseline;
  key?:Key;
}
export class Baseline extends FlutterWidget  {
  child?:FlutterWidget;
  baseline?:number;
  baselineType?:TextBaseline;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key,
        child?:FlutterWidget,
        baseline:number,
        baselineType:TextBaseline,
      }
   */
  static new(config: BaselineConfig) {
    var v = new Baseline();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.baseline = config.baseline;
      v.baselineType = config.baselineType;
      v.child = config.child;
    }
    return v;
  }
}

//****** ButtonBar ******
interface ButtonBarConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  alignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  buttonTextTheme?:ButtonTextTheme;
  buttonHeight?:number;
  buttonMinWidth?:number;
  buttonPadding?:EdgeInsets;
  buttonAlignedDropdown?:boolean;
  layoutBehavior?:ButtonBarLayoutBehavior;
  overflowButtonSpacing?:number;
  overflowDirection?:VerticalDirection;
}
export class ButtonBar extends FlutterWidget {
  key?:Key;
  children?:Array<FlutterWidget>;
  alignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  buttonTextTheme?:ButtonTextTheme;
  buttonHeight?:number;
  buttonMinWidth?:number;
  buttonPadding?:EdgeInsets;
  buttonAlignedDropdown?:boolean;
  layoutBehavior?:ButtonBarLayoutBehavior;
  overflowButtonSpacing?:number;
  overflowDirection?:VerticalDirection;

  /**
   * @param config config: 
      {
        key?:Key, 
        children?:Array<FlutterWidget>, 
        alignment?:MainAxisAlignment, 
        mainAxisSize?:MainAxisSize, 
        buttonTextTheme?:ButtonTextTheme, 
        buttonHeight?:number, 
        buttonMinWidth?:number, 
        buttonPadding?:EdgeInsets, 
        buttonAlignedDropdown?:boolean, 
        layoutBehavior?:ButtonBarLayoutBehavior, 
        overflowButtonSpacing?:number, 
        overflowDirection?:VerticalDirection, 
      }
   */
  static new(config: ButtonBarConfig) {
    var v = new ButtonBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.mainAxisSize = config.mainAxisSize;
      v.buttonAlignedDropdown = config.buttonAlignedDropdown;
      v.buttonTextTheme = config.buttonTextTheme;
      v.buttonHeight = config.buttonHeight;
      v.buttonMinWidth = config.buttonMinWidth;
      v.buttonPadding = config.buttonPadding;
      v.layoutBehavior = config.layoutBehavior;
      v.overflowButtonSpacing = config.overflowButtonSpacing;
      v.overflowDirection = config.overflowDirection;
      v.children = config.children;
    }
    return v;
  }
}

//****** BlockSemantics ******
interface BlockSemanticsConfig {
  child?:FlutterWidget;
  blocking?:boolean;
  key?:Key;
}
export class BlockSemantics extends FlutterWidget {
  child?:FlutterWidget;
  blocking?:boolean;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        blocking?:boolean,
      }
   */
  static new(config: BlockSemanticsConfig) {
    var v = new BlockSemantics();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.blocking = config.blocking;
      v.child = config.child;
    }
    return v;
  }
}

//****** BottomAppBar ******
interface BottomAppBarConfig {
  child?:FlutterWidget;
  color?:Color;
  elevation?:number;
  shape?:NotchedShape;
  clipBehavior?:Clip;
  notchMargin?:number;
  key?:Key;
}
export class BottomAppBar extends FlutterWidget {
  child?:FlutterWidget;
  color?:Color;
  elevation?:number;
  shape?:NotchedShape;
  clipBehavior?:Clip;
  notchMargin?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        color?:Color, 
        elevation?:number, 
        shape?:NotchedShape, 
        clipBehavior?:Clip, 
        notchMargin?:number, 
      }
   */
  static new(config: BottomAppBarConfig) {
    var v = new BottomAppBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.elevation = config.elevation;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.notchMargin = config.notchMargin;
      v.child = config.child;
    }
    return v;
  }
}

//****** BottomNavigationBar ******
interface BottomNavigationBarConfig {
  key?:Key;
  items:Array<BottomNavigationBarItem>;
  onTap?:VoidValueChangedNumber;
  currentIndex?:number;
  elevation?:number;
  type?:BottomNavigationBarType;
  fixedColor?:Color;
  backgroundColor?:Color;
  iconSize?:number;
  selectedItemColor?:Color;
  unselectedItemColor?:Color;
  selectedIconTheme?:IconThemeData;
  unselectedIconTheme?:IconThemeData;
  selectedFontSize?:number;
  unselectedFontSize?:number;
  selectedLabelStyle?:TextStyle;
  unselectedLabelStyle?:TextStyle;
  showSelectedLabels?:boolean;
  showUnselectedLabels?:boolean;
}
export class BottomNavigationBar extends FlutterWidget {
  key?:Key;
  items?:Array<BottomNavigationBarItem>;
  onTap?:VoidValueChangedNumber;
  currentIndex?:number;
  elevation?:number;
  type?:BottomNavigationBarType;
  fixedColor?:Color;
  backgroundColor?:Color;
  iconSize?:number;
  selectedItemColor?:Color;
  unselectedItemColor?:Color;
  selectedIconTheme?:IconThemeData;
  unselectedIconTheme?:IconThemeData;
  selectedFontSize?:number;
  unselectedFontSize?:number;
  selectedLabelStyle?:TextStyle;
  unselectedLabelStyle?:TextStyle;
  showSelectedLabels?:boolean;
  showUnselectedLabels?:boolean;
 
  /**
   * @param config config: 
      {
        key?:Key, 
        items:Array<BottomNavigationBarItem>, 
        onTap?:VoidValueChangedInt, 
        currentIndex?:number, 
        elevation?:number, 
        type?:BottomNavigationBarType, 
        fixedColor?:Color, 
        backgroundColor?:Color, 
        iconSize?:number, 
        selectedItemColor?:Color, 
        unselectedItemColor?:Color, 
        selectedIconTheme?:IconThemeData, 
        unselectedIconTheme?:IconThemeData, 
        selectedFontSize?:number, 
        unselectedFontSize?:number, 
        selectedLabelStyle?:TextStyle, 
        unselectedLabelStyle?:TextStyle, 
        showSelectedLabels?:boolean, 
        showUnselectedLabels?:boolean, 
      }
   */
  static new(config: BottomNavigationBarConfig) {
    var v = new BottomNavigationBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.items = config.items;
      v.onTap = config.onTap;
      v.currentIndex = config.currentIndex;
      v.elevation = config.elevation;
      v.type = config.type;
      v.fixedColor = config.fixedColor;
      v.backgroundColor = config.backgroundColor;
      v.iconSize = config.iconSize;
      v.selectedItemColor = config.selectedItemColor;
      v.unselectedItemColor = config.unselectedItemColor;
      v.selectedIconTheme = config.selectedIconTheme;
      v.unselectedIconTheme = config.unselectedIconTheme;
      v.selectedFontSize = config.selectedFontSize;
      v.unselectedFontSize = config.unselectedFontSize;
      v.selectedLabelStyle = config.selectedLabelStyle;
      v.unselectedLabelStyle = config.unselectedLabelStyle;
      v.showSelectedLabels = config.showSelectedLabels;
      v.showUnselectedLabels = config.showUnselectedLabels;
    }
    return v;
  }
}

//****** BackButtonIcon ******
interface BackButtonIconConfig {
  key?:Key;
}
export class BackButtonIcon extends FlutterWidget {
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
      }
   */
  static new(config: BackButtonIconConfig) {
    var v = new BackButtonIcon();
    if(config!=null && config!=undefined){
      v.key = config.key;
    }
    return v;
  }
}

//****** BackButton ******
interface BackButtonConfig {
  key?:Key;
  onPressed?:VoidCallback;
}
export class BackButton extends FlutterWidget {
  key?:Key;
  onPressed?:VoidCallback;

  /**
   * @param config config: 
      {
        key?:Key, 
        onPressed?:VoidCallback,
      }
   */
  static new(config: BackButtonConfig) {
    var v = new BackButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
    }
    return v;
  }
}

//****** TODO Builder ******
interface BuilderConfig {
  builder?:any;
  key?:Key;
}
export class Builder extends FlutterWidget {
  builder?:any;
  key?:Key;
  child?:Builder;

  preBuild(jsWidgetHelper?:any, buildContext?:JSBuildContext) {
    if (this.builder) {
      this.child = this.builder(buildContext);
      delete this.builder;
    }
    super.preBuild(jsWidgetHelper, buildContext);
  }

  static new(builder?:any, key?:Key) {
    var v = new Builder();
    v.key = key;
    v.builder = builder;

    // 本地创建的，供flutter使用
    v.child = undefined;
    return v;
  }
}
//#endregion

//#region ------- C -------

//****** CloseButton ******
interface CloseButtonConfig {
  key?:Key;
  onPressed?:VoidCallback;
  color?:Color;
}
export class CloseButton extends FlutterWidget {
  key?:Key;
  onPressed?:VoidCallback;
  color?:Color;

  /**
   * @param config config: 
      {
        key?:Key, 
        onPressed?:VoidCallback,
        color?:Color, 
      }
   */
  static new(config: CloseButtonConfig) {
    var v = new CloseButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.color = config.color;
    }
    return v;
  }
}

//****** Container ******
interface ContainerConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  margin?:EdgeInsets;
  padding?:EdgeInsets;
  color?:Color;
  width?:number;
  height?:number;
  decoration?:BoxDecoration;
  foregroundDecoration?:BoxDecoration;
  constraints?:BoxConstraints;
  transform?:Matrix4;  
  clipBehavior?:Clip;
}
export class Container extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  margin?:EdgeInsets;
  padding?:EdgeInsets;
  color?:Color;
  width?:number;
  height?:number;
  decoration?:BoxDecoration;
  foregroundDecoration?:BoxDecoration;
  constraints?:BoxConstraints;
  transform?:Matrix4;
  key?:Key;
  clipBehavior?:Clip;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        alignment?:Alignment, 
        margin?:EdgeInsets, 
        padding?:EdgeInsets, 
        color?:Color,
        width?:number, 
        height?:number, 
        decoration?:BoxDecoration, 
        foregroundDecoration?:BoxDecoration,
        constraints?:BoxConstraints, 
        transform?:Matrix4,
        clipBehavior?:Clip,
      }
   */
  static new(config: ContainerConfig) {
      var v = new Container();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.alignment = config.alignment;
        v.padding = config.padding;
        v.color = config.color;
        v.decoration = config.decoration;
        v.foregroundDecoration = config.foregroundDecoration;
        v.width = config.width;
        v.height = config.height;
        v.constraints = config.constraints;
        v.margin = config.margin;
        v.transform = config.transform;
        v.child = config.child;
        v.clipBehavior = config.clipBehavior;
      }
      return v;
  }
}

//****** Center ******
interface CenterConfig {
  child?:FlutterWidget;
  widthFactor?:number;
  heightFactor?:number;
  key?:Key;
}
export class Center extends FlutterWidget {
  child?:FlutterWidget;
  widthFactor?:number;
  heightFactor?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        widthFactor?:number, 
        heightFactor?:number, 
      }
   */
  static new(config: CenterConfig) {
    var v = new Center();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.widthFactor = config.widthFactor;
      v.heightFactor = config.heightFactor;
      v.child = config.child;
    }
    return v;
  }
}

//****** ColoredBox ******
interface ColoredBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  color:Color;
}
export class ColoredBox extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  color?:Color;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        color:Color, 
      }
   */
  static new(config: ColoredBoxConfig) {
    var v = new ColoredBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.child = config.child;
    }
    return v;
  }
}


//****** CircleAvatar ******
interface CircleAvatarConfig {
  key?:Key;
  child?:FlutterWidget;
  backgroundColor?:Color;
  foregroundColor?:Color
  backgroundImage?:any;
  radius?:number;
  minRadius?:number;
  maxRadius?:number;
}
export class CircleAvatar extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  backgroundColor?:Color;
  foregroundColor?:Color
  backgroundImage?:any;
  radius?:number;
  minRadius?:number;
  maxRadius?:number;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        backgroundColor?:Color, 
        foregroundColor?:Color, 
        radius?:number, 
        backgroundImage?:any,
        minRadius?:number, 
        maxRadius?:number,
        key?:Key, 
      }
   */
  static new(config: CircleAvatarConfig) {
    var v = new CircleAvatar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.backgroundColor = config.backgroundColor;
      v.backgroundImage = config.backgroundImage;
      v.foregroundColor = config.foregroundColor;
      v.radius = config.radius;
      v.minRadius = config.minRadius;
      v.maxRadius = config.maxRadius;
    }
    return v;
  }
}

//****** Chip ******
interface ChipConfig {
  key?:Key;
  avatar?:FlutterWidget;
  label:FlutterWidget;
  labelStyle?:TextStyle;
  labelPadding?:EdgeInsets;
  deleteIcon?:FlutterWidget;
  onDeleted?:VoidCallback;
  deleteIconColor?:Color;
  deleteButtonTooltipMessage?:string;
  clipBehavior?:Clip;
  backgroundColor?:Color;
  padding?:EdgeInsets;
  materialTapTargetSize?:MaterialTapTargetSize;
  elevation?:number;
  shadowColor?:Color;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
}
export class Chip extends FlutterWidget {
  key?:Key;
  avatar?:FlutterWidget;
  label?:FlutterWidget;
  labelStyle?:TextStyle;
  labelPadding?:EdgeInsets;
  deleteIcon?:FlutterWidget;
  onDeleted?:VoidCallback;
  deleteIconColor?:Color;
  deleteButtonTooltipMessage?:string;
  clipBehavior?:Clip;
  backgroundColor?:Color;
  padding?:EdgeInsets;
  materialTapTargetSize?:MaterialTapTargetSize;
  elevation?:number;
  shadowColor?:Color;
  visualDensity?:VisualDensity;
  autofocus?:boolean;

  /**
   * @param config config: 
      {
        avatar?:FlutterWidget,
        label:FlutterWidget,
        labelStyle?:TextStyle,
        labelPadding?:EdgeInsets,
        deleteIcon?:FlutterWidget,
        onDeleted?:VoidCallback, 
        deleteIconColor?:Color, 
        deleteButtonTooltipMessage?:string, 
        clipBehavior?:Clip,
        backgroundColor?:Color, 
        padding?:EdgeInsets, 
        materialTapTargetSize?:MaterialTapTargetSize,
        elevation?:number,
        key?:Key,
        shadowColor?:Color,
        visualDensity?:VisualDensity,
        autofocus?:boolean,
      }
   */
  static new (config: ChipConfig) {
    var v = new Chip();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.avatar = config.avatar;
      v.label = config.label;
      v.labelStyle = config.labelStyle;
      v.labelPadding = config.labelPadding;
      v.deleteIcon = config.deleteIcon;
      v.onDeleted = config.onDeleted;
      v.deleteIconColor = config.deleteIconColor;
      v.deleteButtonTooltipMessage = config.deleteButtonTooltipMessage;
      v.clipBehavior = config.clipBehavior;
      v.backgroundColor = config.backgroundColor;
      v.padding = config.padding;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.elevation = config.elevation;
      v.autofocus = config.autofocus;
      v.shadowColor = config.shadowColor;
      v.visualDensity = config.visualDensity;
    }
    return v;
  }
}

//****** CheckedModeBanner ******
interface CheckedModeBannerConfig {
  key?:Key;
  child:FlutterWidget;
}
export class CheckedModeBanner extends FlutterWidget  {
  key?:Key;
  child?:FlutterWidget;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
      }
   */
  static new(config: CheckedModeBannerConfig) {
    var v = new CheckedModeBanner();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}

//****** CheckboxListTile ******
interface CheckboxListTileConfig {
  key?:Key;
  value:boolean;
  onChanged:VoidValueChangedBoolean;
  activeColor?:Color;
  checkColor?:Color;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  isThreeLine?:boolean;
  dense?:boolean;
  contentPadding?:EdgeInsets;
  secondary?:FlutterWidget;
  selected?:boolean;
  autofocus?:boolean;
  controlAffinity?:ListTileControlAffinity;
  tristate?:boolean;
}
export class CheckboxListTile extends FlutterWidget {
  key?:Key;
  value?:boolean;
  onChanged?:VoidValueChangedBoolean;
  activeColor?:Color;
  checkColor?:Color;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  isThreeLine?:boolean;
  dense?:boolean;
  contentPadding?:EdgeInsets;
  secondary?:FlutterWidget;
  selected?:boolean;
  autofocus?:boolean;
  controlAffinity?:ListTileControlAffinity;
  tristate?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        value:boolean, 
        onChanged:VoidValueChangedBoolean, 
        activeColor?:Color, 
        checkColor?:Color, 
        title?:FlutterWidget, 
        subtitle?:FlutterWidget, 
        isThreeLine?:boolean, 
        dense?:boolean, 
        contentPadding?:EdgeInsets, 
        secondary?:FlutterWidget, 
        selected?:boolean, 
        autofocus?:boolean, 
        controlAffinity?:ListTileControlAffinity, 
        tristate?:boolean, 
      }
   */
  static new(config: CheckboxListTileConfig) {
    var v = new CheckboxListTile();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.activeColor = config.activeColor;
      v.checkColor = config.checkColor;
      v.title = config.title;
      v.subtitle = config.subtitle;
      v.isThreeLine = config.isThreeLine;
      v.dense = config.dense;
      v.contentPadding = config.contentPadding;
      v.secondary = config.secondary;
      v.selected = config.selected;
      v.autofocus = config.autofocus;
      v.controlAffinity = config.controlAffinity;
      v.tristate = config.tristate;
    }
    return v;
  }
}

//****** Checkbox ******
interface CheckboxConfig {
  key?:Key;
  value:boolean;
  onChanged:VoidValueChangedBoolean;
  activeColor?:Color;
  checkColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  materialTapTargetSize?:MaterialTapTargetSize;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
  tristate?:boolean;
}
export class Checkbox extends FlutterWidget {
  key?:Key;
  value?:boolean;
  onChanged?:VoidValueChangedBoolean;
  activeColor?:Color;
  checkColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  materialTapTargetSize?:MaterialTapTargetSize;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
  tristate?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        value:boolean, 
        onChanged:VoidValueChangedBoolean, 
        activeColor?:Color, 
        checkColor?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        materialTapTargetSize?:MaterialTapTargetSize, 
        visualDensity?:VisualDensity, 
        autofocus?:boolean, 
        tristate?:boolean, 
      }
   */
  static new(config: CheckboxConfig) {
    var v = new Checkbox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.activeColor = config.activeColor;
      v.checkColor = config.checkColor;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.autofocus = config.autofocus;
      v.visualDensity = config.visualDensity;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.tristate = config.tristate;
    }
    return v;
  }
}


//****** TODO ClipRRect ******
interface ClipRRectConfig {
  key?:Key;
  borderRadius?:BorderRadius;
  clipBehavior?:Clip;
  child?:FlutterWidget;
}
export class ClipRRect extends FlutterWidget {
  key?:Key;
  borderRadius?:BorderRadius;
  clipBehavior?:Clip;
  child?:FlutterWidget;
  
  /**
   * @param config config: 
      {
        child?:FlutterWidget,
        borderRadius?:BorderRadius,
        clipBehavior?:Clip,
        key?:Key
      }
   */
  static new(config: ClipRRectConfig){
    var v = new ClipRRect();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.borderRadius = config.borderRadius;
      v.clipBehavior = config.clipBehavior;
      v.child = config.child;
    }
    return v;
  }
}

//****** ConstrainedBox ******
interface ConstrainedBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  constraints:BoxConstraints;  
}
export class ConstrainedBox extends FlutterWidget {
  child?:FlutterWidget;
  constraints?:BoxConstraints;
  key?:Key;
  
  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        constraints:BoxConstraints, 
        key?:Key,
      }
   */
  static new(config: ConstrainedBoxConfig) {
    var v = new ConstrainedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.constraints = config.constraints;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO CustomSingleChildLayout ******
interface CustomSingleChildLayoutConfig {
  key?:Key;
  child?:FlutterWidget;
  delegate?:any;
}
export class CustomSingleChildLayout extends FlutterWidget {
  child?:FlutterWidget;
  delegate?:any;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        delegate?:any, 
        key?:Key,
      }
   */
  static new(config: CustomSingleChildLayoutConfig) {
    var v =new CustomSingleChildLayout();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
      v.child = config.child;
    }
    return v;
  }
}

//****** Column ******
interface ColumnConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  mainAxisAlignment?:MainAxisAlignment;
  crossAxisAlignment?:CrossAxisAlignment;
  mainAxisSize?:MainAxisSize;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
}
export class Column extends FlutterWidget {
  children?:Array<FlutterWidget>;
  mainAxisAlignment?:MainAxisAlignment;
  crossAxisAlignment?:CrossAxisAlignment;
  mainAxisSize?:MainAxisSize;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        mainAxisAlignment?:MainAxisAlignment, 
        crossAxisAlignment?:CrossAxisAlignment,
        mainAxisSize?:MainAxisSize, 
        textDirection?:TextDirection, 
        verticalDirection?:VerticalDirection,
        textBaseline?:TextBaseline, 
        key?:Key,
      }
   */
  static new(config: ColumnConfig) {
      var v = new Column();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.mainAxisAlignment = config.mainAxisAlignment;
        v.mainAxisSize = config.mainAxisSize;
        v.crossAxisAlignment = config.crossAxisAlignment;
        v.textDirection = config.textDirection;
        v.verticalDirection = config.verticalDirection;
        v.textBaseline = config.textBaseline;
        v.children = config.children;
      }
    return v;
  }
}

//****** TODO CustomMultiChildLayout ******
interface CustomMultiChildLayoutConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  delegate?:any;
}
export class CustomMultiChildLayout extends FlutterWidget {
  children?:Array<FlutterWidget>;
  delegate?:any;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        delegate?:any, 
        key?:Key
      }
   */
  static new(config: CustomMultiChildLayoutConfig) {
    var v = new CustomMultiChildLayout();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
      v.children = config.children;
    }
    return v;
  }
}

//****** CustomScrollView ******
interface CustomScrollViewConfig {
  key?:Key;
  slivers?:Array<FlutterWidget>;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  primary?:boolean;
  physics?:ScrollPhysics;
  shrinkWrap?:boolean;
  center?:Key;
  anchor?:number;
  cacheExtent?:number;
  semanticChildCount?:number;
  dragStartBehavior?:DragStartBehavior;
  restorationId?:string;
  clipBehavior?:Clip;

}
export class CustomScrollView extends FlutterWidget {
  key?:Key;
  slivers?:Array<FlutterWidget>;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  primary?:boolean;
  physics?:ScrollPhysics;
  shrinkWrap?:boolean;
  center?:Key;
  anchor?:number;
  cacheExtent?:number;
  semanticChildCount?:number;
  dragStartBehavior?:DragStartBehavior;
  restorationId?:string;
  clipBehavior?:Clip;
  /**
   * @param config config: 
      {
        key?:Key, 
        slivers?:Array<FlutterWidget>, 
        controller?:ScrollController, 
        scrollDirection?:Axis, 
        reverse?:boolean, 
        primary?:boolean, 
        physics?:ScrollPhysics, 
        shrinkWrap?:boolean, 
        center?:Key, 
        anchor?:number, 
        cacheExtent?:number, 
        semanticChildCount?:number, 
        dragStartBehavior?:DragStartBehavior, 
        restorationId?:string, 
        clipBehavior?:Clip, 
      }
   */
  static new(config: CustomScrollViewConfig) {
      var v = new CustomScrollView();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.scrollDirection = config.scrollDirection;
        v.reverse = config.reverse;
        v.controller = config.controller;
        v.primary = config.primary;
        v.physics = config.physics;
        v.shrinkWrap = config.shrinkWrap;
        v.center = config.center;
        v.anchor = config.anchor;
        v.cacheExtent = config.cacheExtent;
        v.slivers = config.slivers;
        v.semanticChildCount = config.semanticChildCount;
        v.dragStartBehavior = config.dragStartBehavior;
        v.restorationId = config.restorationId;
        v.clipBehavior = config.clipBehavior;
      }
    return v;
  }
}

//****** Card ******
interface CardConfig {
  key?:Key;
  child?:FlutterWidget;
  margin?:EdgeInsets;
  color?:Color;
  shadowColor?:Color;
  elevation?:number;
  shape?:any;
  clipBehavior?:Clip;
  semanticContainer?:boolean;  
  borderOnForeground?:boolean;
}
export class Card extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  margin?:EdgeInsets;
  color?:Color;
  shadowColor?:Color;
  elevation?:number;
  shape?:any;
  clipBehavior?:Clip;
  semanticContainer?:boolean;  
  borderOnForeground?:boolean;

  /**
   * @param config config: 
      {
        key?:Key,
        child?:FlutterWidget, 
        margin?:EdgeInsets, 
        color?:Color,
        shadowColor?:Color, 
        elevation?:number, 
        shape?:any, 
        clipBehavior?:Clip, 
        semanticContainer?:boolean, 
        borderOnForeground?:boolean,
      }
   */
  static new(config: CardConfig) {
    var v = new Card();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.elevation = config.elevation;
      v.shape = config.shape;
      v.margin = config.margin;
      v.clipBehavior = config.clipBehavior;
      v.child = config.child;
      v.semanticContainer = config.semanticContainer;
      v.borderOnForeground = config.borderOnForeground;
      v.shadowColor = config.shadowColor;
    }
    return v;
  }
}
//#endregion

//#region ------- D -------
//****** Divider ******
interface DividerConfig {
    key?:Key;
    height?:number;
    thickness?:number;
    indent?:number;
    endIndent?:number;
    color?:Color;
}
export class Divider extends FlutterWidget {
  key?:Key;
  height?:number;
  thickness?:number;
  indent?:number;
  endIndent?:number;
  color?:Color;

  /**
   * @param config config: 
    {
      key?:Key, 
      height?:number, 
      thickness?:number, 
      indent?:number, 
      endIndent?:number, 
      color?:Color
    }
   */
  static new(config: DividerConfig) {
    var v = new Divider();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.height = config.height;
      v.thickness = config.thickness;
      v.indent = config.indent;
      v.endIndent = config.endIndent;
      v.color = config.color;
    }
    return v;
  }
}

//****** Directionality ******
interface DirectionalityConfig {
  key?:Key;
  child:FlutterWidget;
  textDirection:TextDirection;
}
export class Directionality extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  textDirection?:TextDirection;

  /**
   * @param config config: 
      {
        key?:Key,
        child:FlutterWidget,
        textDirection:TextDirection,
      }
   */
  static new(config: DirectionalityConfig) {
    var v = new Directionality();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.textDirection = config.textDirection;
      v.child = config.child;
    }
    return v;
  }
}

//****** DropdownMenuItem ******
interface DropdownMenuItemConfig {
  child:FlutterWidget;  
  value?:number;
  key?:Key;
  onTap?:VoidCallback;
}
export class DropdownMenuItem extends FlutterWidget {
  child?:FlutterWidget;  
  value?:number;
  key?:Key;
  onTap?:VoidCallback;

  /**
   * @param config config: 
      {
        child:FlutterWidget,
        value?:number,
        key?:Key,
        onTap?:VoidCallback,
      }
   */
  static new(config: DropdownMenuItemConfig) {
    var v = new DropdownMenuItem();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.child = config.child;
      v.onTap = config.onTap;
    }
    return v;
  }
}


//****** DecoratedBox ******
interface DecoratedBoxConfig {
  child?:FlutterWidget;
  decoration:BoxDecoration;
  position?:DecorationPosition;
  key?:Key;
}
export class DecoratedBox extends FlutterWidget {
  child?:FlutterWidget;
  decoration?:BoxDecoration;
  position?:DecorationPosition;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        decoration:BoxDecoration, 
        position?:DecorationPosition, 
        key?:Key,
      }
   */
  static new(config: DecoratedBoxConfig) {
    var v = new DecoratedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.decoration = config.decoration;
      v.position = config.position;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO DropdownButton ******
interface DropdownButtonConfig {
  items?:Array<DropdownMenuItem>;
  onChanged?:any;
  value?:any;
  hint?:FlutterWidget;
  disabledHint?:FlutterWidget;
  elevation?:number;
  style?:TextStyle;
  iconSize?:number;
  isDense?:boolean;
  isExpanded?:boolean;
  key?:Key;
}
export class DropdownButton extends FlutterWidget {
  items?:Array<DropdownMenuItem>;
  onChanged?:any;
  value?:any;
  hint?:FlutterWidget;
  disabledHint?:FlutterWidget;
  elevation?:number;
  style?:TextStyle;
  iconSize?:number;
  isDense?:boolean;
  isExpanded?:boolean;
  key?:Key;

  /**
   * @param config config: 
      {
        items?:Array<DropdownMenuItem>, 
        onChanged?:any, 
        value?:any, hint?:FlutterWidget,
        disabledHint?:FlutterWidget, 
        elevation?:number, 
        style?:TextStyle, 
        iconSize?:number,
        isDense?:boolean, 
        isExpanded?:boolean, 
        key?:Key,
      }
   */
  static new(config: DropdownButtonConfig) {
      var v = new DropdownButton();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.items = config.items;
        v.value = config.value;
        v.hint = config.hint;
        v.disabledHint = config.disabledHint;
        v.onChanged = config.onChanged;
        v.elevation = config.elevation;
        v.style = config.style;
        v.iconSize = config.iconSize;
        v.isDense = config.isDense;
        v.isExpanded = config.isExpanded;
      }
    return v;
  }
}

//****** DefaultTabController ******
interface DefaultTabControllerConfig {
  key?:Key;
  child:FlutterWidget;
  length:number;
  initialIndex?:number;  
}
export class DefaultTabController extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  length?:number;
  initialIndex?:number;  

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        length:number, 
        initialIndex?:number, 
      }
   */
  static new(config: DefaultTabControllerConfig) {
    var v = new DefaultTabController();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.length = config.length;
      v.initialIndex = config.initialIndex;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO DecorationImage ******
interface DecorationImageConfig {
  image?:any;
  alignment?:Alignment;
  colorFilter?:ColorFilter;
  fit?:BoxFit;
  centerSlice?:Rect;
  repeat?:ImageRepeat;
  matchTextDirection?:boolean;
  scale?:number;
}
export class DecorationImage extends FlutterWidget {
  image?:any;
  alignment?:Alignment;
  colorFilter?:ColorFilter;
  fit?:BoxFit;
  centerSlice?:Rect;
  repeat?:ImageRepeat;
  matchTextDirection?:boolean;
  scale?:number;
  
  /**
   * @param config config: 
      {
        image?:any, 
        alignment?:Alignment, 
        colorFilter?:ColorFilter, 
        fit?:BoxFit, 
        centerSlice?:Rect, 
        repeat?:ImageRepeat, 
        matchTextDirection?:boolean, 
        scale?:number,
      }
   */
  static new(config: DecorationImageConfig) {
    var v = new DecorationImage();
    if(config!=null && config!=undefined){
      v.image = config.image;
      v.colorFilter = config.colorFilter;
      v.fit = config.fit;
      v.alignment = config.alignment;
      v.centerSlice = config.centerSlice;
      v.repeat = config.repeat;
      v.matchTextDirection = config.matchTextDirection;
      v.scale = config.scale;
    }
    return v;
  }
}

//****** TODO DefaultTextStyle ******
interface DefaultTextStyleConfig {
  child?:FlutterWidget;
  style?:TextStyle;
  textAlign?:TextAlign;
  softWrap?:boolean;
  overflow?:TextOverflow;
  maxLines?:number;
  key?:Key;
}
export class DefaultTextStyle extends FlutterWidget {
  child?:FlutterWidget;
  style?:TextStyle;
  textAlign?:TextAlign;
  softWrap?:boolean;
  overflow?:TextOverflow;
  maxLines?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        style?:TextStyle, 
        textAlign?:TextAlign, 
        softWrap?:boolean, 
        overflow?:TextOverflow, 
        maxLines?:number, 
        key?:Key
      }
   */
  static new(config: DefaultTextStyleConfig) {
    var v = new DefaultTextStyle();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.style = config.style;
      v.textAlign = config.textAlign;
      v.softWrap = config.softWrap;
      v.overflow = config.overflow;
      v.maxLines = config.maxLines;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO DecoratedBoxTransition ******
interface DecoratedBoxTransitionConfig {
  key?:Key;
  decoration?:any;
  position?:DecorationPosition;
  child?:FlutterWidget;
}
export class DecoratedBoxTransition extends FlutterWidget {
  key?:Key;
  decoration?:any;
  position?:DecorationPosition;
  child?:FlutterWidget;
  /**
   * @param config config: 
      {
        key?:Key, 
        decoration?:any, 
        position?:DecorationPosition, 
        child?:FlutterWidget
      }
   */
  static new(config: DecoratedBoxTransitionConfig) {
    var v = new DecoratedBoxTransition();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.decoration = config.decoration;
      v.position = config.position;
      v.child = config.child;
    }
    return v;
  }
}
//#endregion

//#region ------- E -------
//****** ExcludeSemantics ******
interface ExcludeSemanticsConfig {
  child?:FlutterWidget;
  excluding?:boolean;
  key?:Key;
}
export class ExcludeSemantics extends FlutterWidget {
  child?:FlutterWidget;
  excluding?:boolean;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        excluding?:boolean,
      }
   */
  static new(config?: ExcludeSemanticsConfig) {
    var v = new ExcludeSemantics();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.excluding = config.excluding;
      v.child = config.child;
    }
    return v;
  }
}

//****** Expanded ******
interface ExpandedConfig {
  child:FlutterWidget;
  flex?:number;
  key?:Key;
}
export class Expanded extends FlutterWidget {
  child?:FlutterWidget;
  flex?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child:FlutterWidget, 
        flex?:number, 
        key?:Key,
      }
   */
  static new(config: ExpandedConfig) {
    var v = new Expanded();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.flex = config.flex;
      v.child = config.child;
    }
    return v;
  }
}

//****** ExpandIcon ******
interface ExpandIconConfig {
  key?:Key;
  isExpanded?:boolean;
  size?:number;
  onPressed:VoidValueChangedBoolean;
  padding?:EdgeInsets;
  color?:Color;
  disabledColor?:Color;
  expandedColor?:Color;
}
export class ExpandIcon extends FlutterWidget {
  key?:Key;
  isExpanded?:boolean;
  size?:number;
  onPressed?:VoidValueChangedBoolean;
  padding?:EdgeInsets;
  color?:Color;
  disabledColor?:Color;
  expandedColor?:Color;

  /**
   * @param config config: 
      {
        key?:Key, 
        isExpanded?:boolean, 
        size?:number, 
        onPressed:VoidValueChangedBoolean, 
        padding?:EdgeInsets, 
        color?:Color, 
        disabledColor?:Color, 
        expandedColor?:Color, 
      }
   */
  static new(config: ExpandIconConfig) {
    var v = new ExpandIcon();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.isExpanded = config.isExpanded;
      v.size = config.size;
      v.onPressed = config.onPressed;
      v.padding = config.padding;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.expandedColor = config.expandedColor;
    }
    return v;
  }
}


//****** TODO ExpansionTile ******
interface ExpansionTileConfig {
    key?:Key;
    leading?:FlutterWidget;
    title?:FlutterWidget;
    subtitle?:FlutterWidget;
    backgroundColor?:Color;
    onExpansionChanged?:VoidValueChangedBoolean;
    children?:Array<FlutterWidget>;
    trailing?:FlutterWidget;
    initiallyExpanded?:boolean;
    maintainState?:boolean;
    tilePadding?:EdgeInsets;
    expandedCrossAxisAlignment?:CrossAxisAlignment;
    expandedAlignment?:Alignment;
    childrenPadding?:EdgeInsets;
}
export class ExpansionTile extends FlutterWidget {
    key?:Key;
    leading?:FlutterWidget;
    title?:FlutterWidget;
    subtitle?:FlutterWidget;
    backgroundColor?:Color;
    onExpansionChanged?:VoidValueChangedBoolean;
    children?:Array<FlutterWidget>;
    trailing?:FlutterWidget;
    initiallyExpanded?:boolean;
    maintainState?:boolean;
    tilePadding?:EdgeInsets;
    expandedCrossAxisAlignment?:CrossAxisAlignment;
    expandedAlignment?:Alignment;
    childrenPadding?:EdgeInsets;

  /**
   * @param config config: 
      {
        key?:Key, 
        leading?:FlutterWidget, 
        title?:FlutterWidget, 
        subtitle?:FlutterWidget, 
        backgroundColor?:Color, 
        onExpansionChanged?:VoidValueChangedBoolean, 
        children?:Array<FlutterWidget>,
        trailing?:FlutterWidget, 
        initiallyExpanded?:boolean, 
        maintainState?:boolean, 
        tilePadding?:EdgeInsets, 
        expandedCrossAxisAlignment?:CrossAxisAlignment, 
        expandedAlignment?:Alignment, 
        childrenPadding?:EdgeInsets,
      }
   */
  static new(config: ExpansionTileConfig) {
    var v = new ExpansionTile();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.leading = config.leading;
      v.title = config.title;
      v.subtitle = config.subtitle;
      v.backgroundColor = config.backgroundColor;
      v.onExpansionChanged = config.onExpansionChanged;
      v.children = config.children;
      v.trailing = config.trailing;
      v.initiallyExpanded = config.initiallyExpanded;
      v.maintainState = config.maintainState;
      v.tilePadding = config.tilePadding;
      v.expandedCrossAxisAlignment = config.expandedCrossAxisAlignment;
      v.expandedAlignment = config.expandedAlignment;
      v.childrenPadding = config.childrenPadding;
    }
    return v;
  }
}

//#endregion

//#region ------- F -------

//****** Flexible ******
interface FlexibleConfig {
  key?:Key;
  child:FlutterWidget;
  flex?:number;
  fit?:FlexFit;
  
}
export class Flexible extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  flex?:number;
  fit?:FlexFit;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        flex?:number, 
        fit?:FlexFit,
      }
   */
  static new (config: FlexibleConfig) {
    var v = new Flexible();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.fit = config.fit;
      v.flex = config.flex;
      v.child = config.child;
    }
    return v;
  }
}

//****** FittedBox ******
interface FittedBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  fit?:BoxFit;
}
export class FittedBox extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  fit?:BoxFit;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      alignment?:Alignment, 
      fit?:BoxFit,
    }
   */
  static new (config: FittedBoxConfig) {
    var v = new FittedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.fit = config.fit;
      v.alignment = config.alignment;
      v.child = config.child;
    }
    return v;
  }
}

//****** FractionallySizedBox ******
interface FractionallySizedBoxConfig {
  child?:FlutterWidget;
  alignment?:Alignment;
  widthFactor?:number;
  heightFactor?:number;
  key?:Key;
}
export class FractionallySizedBox extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  widthFactor?:number;
  heightFactor?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        alignment?:Alignment, 
        widthFactor?:number, 
        heightFactor?:number, 
        key?:Key
      }
   */
  static new(config: FractionallySizedBoxConfig) {
    var v = new FractionallySizedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.widthFactor = config.widthFactor;
      v.heightFactor = config.heightFactor;
      v.child = config.child;
    }
    return v;
  }

}

//****** Flex ******
interface FlexConfig {
  key?:Key;
  direction:Axis;
  mainAxisAlignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  crossAxisAlignment?:CrossAxisAlignment;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
  clipBehavior?:Clip;
  children?:Array<FlutterWidget>;
}
export class Flex extends FlutterWidget {
  key?:Key;
  direction?:Axis;
  mainAxisAlignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  crossAxisAlignment?:CrossAxisAlignment;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
  clipBehavior?:Clip;
  children?:Array<FlutterWidget>;

  /**
   * @param config config: 
      {
        key?:Key, 
        direction:Axis, 
        mainAxisAlignment?:MainAxisAlignment, 
        mainAxisSize?:MainAxisSize, 
        crossAxisAlignment?:CrossAxisAlignment, 
        textDirection?:TextDirection, 
        verticalDirection?:VerticalDirection, 
        textBaseline?:TextBaseline, 
        clipBehavior?:Clip, 
        children?:Array<FlutterWidget>, 
      }
   */
  static new (config: FlexConfig) {
    var v = new Flex();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.direction = config.direction;
      v.mainAxisAlignment = config.mainAxisAlignment;
      v.mainAxisSize = config.mainAxisSize;
      v.crossAxisAlignment = config.crossAxisAlignment;
      v.textDirection = config.textDirection;
      v.textBaseline = config.textBaseline;
      v.clipBehavior = config.clipBehavior;
      v.children = config.children;
    }
    return v;
  }
}

//****** TODO Flow ******
interface FlowConfig {
  children?:Array<FlutterWidget>;
  delegate?:any;
  key?:Key;
}
export class Flow extends FlutterWidget {
  children?:Array<FlutterWidget>;
  delegate?:any;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        delegate?:any, 
        key?:Key,
      }
   */
  static new (config: FlowConfig) {
    var v = new Flow();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
      v.children = config.children;
    }
    return v;
  }
}

//****** FlatButton ******
interface FlatButtonConfig {
  child:FlutterWidget;
  onPressed:VoidCallback;
  padding?:EdgeInsets;
  onHighlightChanged?:VoidValueChangedBoolean;
  textTheme?:ButtonTextTheme;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  key?:Key;

  onLongPress?: VoidCallback;
  focusColor?: Color;
  hoverColor?: Color;
  visualDensity?: VisualDensity;
  autofocus?: boolean;

  icon?:FlutterWidget;
  label?:FlutterWidget;
}
export class FlatButton extends FlutterWidget {
  child?:FlutterWidget;
  onPressed?:VoidCallback;
  padding?:EdgeInsets;
  onHighlightChanged?:VoidValueChangedBoolean;
  textTheme?:ButtonTextTheme;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  key?:Key;
  onLongPress?:VoidCallback;
  focusColor?: Color;
  hoverColor?: Color;
  visualDensity?: VisualDensity;
  autofocus?: boolean;
  icon?:FlutterWidget;
  label?:FlutterWidget;
  
  /**
   * @param config config: 
      {
        child:FlutterWidget, 
        onPressed:VoidCallback, 
        padding?:EdgeInsets;, 
        onHighlightChanged?:VoidValueChangedBoolean, 
        textTheme?:ButtonTextTheme, 
        textColor?:Color, 
        disabledTextColor?:Color, 
        color?:Color, 
        disabledColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        colorBrightness?:Brightness, 
        shape?:any, 
        clipBehavior?:Clip, 
        materialTapTargetSize?:MaterialTapTargetSize, 
        key?:Key, 

        onLongPress?: VoidCallback, 
        focusColor?: Color, 
        hoverColor?: Color, 
        visualDensity?: VisualDensity, 
        autofocus?: boolean,
      }
   */
  static new(config: FlatButtonConfig) {
    var v = new FlatButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.onHighlightChanged = config.onHighlightChanged;
      v.textTheme = config.textTheme;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.padding = config.padding;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.visualDensity = config.visualDensity;
      v.autofocus = config.autofocus;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        child:FlutterWidget, 
        onPressed:VoidCallback, 
        padding?:EdgeInsets, 
        onHighlightChanged?:VoidValueChangedBoolean, 
        textTheme?:ButtonTextTheme, 
        textColor?:Color, 
        disabledTextColor?:Color, 
        color?:Color, 
        disabledColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        colorBrightness?:Brightness, 
        shape?:any, 
        clipBehavior?:Clip, 
        materialTapTargetSize?:MaterialTapTargetSize, 
        key?:Key, 

        onLongPress?: VoidCallback, 
        focusColor?: Color, 
        hoverColor?: Color,
        autofocus?: boolean, 

        icon?:FlutterWidget, 
        label?:FlutterWidget, 
      }
   */
  static icon(config: FlatButtonConfig) {
    let v = new FlatButton();
    v.constructorName = "icon";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.onHighlightChanged = config.onHighlightChanged;
      v.textTheme = config.textTheme;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.padding = config.padding;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.autofocus = config.autofocus;
      v.icon = config.icon;
      v.label = config.label;
    }
    return v;
  }
}

//****** FloatingActionButton ******
interface FloatingActionButtonConfig {
  key?:Key;
  child?:FlutterWidget;
  tooltip?:string;
  foregroundColor?:Color;
  backgroundColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  splashColor?:Color;
  elevation?:number;
  focusElevation?:number;
  hoverElevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  onPressed:VoidCallback;
  mini?:boolean;
  shape?:ShapeBorder;
  clipBehavior?:Clip;
  autofocus?:boolean;
  materialTapTargetSize?:MaterialTapTargetSize;
  isExtended?:boolean;
  
}
export class FloatingActionButton extends FlutterWidget  {
  key?:Key;
  child?:FlutterWidget;
  tooltip?:string;
  foregroundColor?:Color;
  backgroundColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  splashColor?:Color;
  elevation?:number;
  focusElevation?:number;
  hoverElevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  onPressed?:VoidCallback;
  mini?:boolean;
  shape?:ShapeBorder;
  clipBehavior?:Clip;
  autofocus?:boolean;
  materialTapTargetSize?:MaterialTapTargetSize;
  isExtended?:boolean;


  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        tooltip?:string, 
        foregroundColor?:Color, 
        backgroundColor?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        splashColor?:Color, 
        elevation?:number, 
        focusElevation?:number, 
        hoverElevation?:number, 
        highlightElevation?:number, 
        disabledElevation?:number, 
        onPressed:VoidCallback, 
        mini?:boolean, 
        shape?:ShapeBorder, 
        clipBehavior?:Clip, 
        autofocus?:boolean, 
        materialTapTargetSize?:MaterialTapTargetSize, 
        isExtended?:boolean, 
      }
   */
  static new(config: FloatingActionButtonConfig) {
    var v =  new FloatingActionButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.tooltip = config.tooltip;
      v.foregroundColor = config.foregroundColor;
      v.backgroundColor = config.backgroundColor;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.splashColor = config.splashColor;

      v.elevation = config.elevation;
      v.focusElevation = config.focusElevation;
      v.hoverElevation = config.hoverElevation;
      v.highlightElevation = config.highlightElevation;
      v.disabledElevation = config.disabledElevation;
      v.onPressed = config.onPressed;
      v.mini = config.mini;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.isExtended = config.isExtended;
      v.autofocus = config.autofocus;
    }
    return v ;
  }
}

//****** FlexibleSpaceBar ******
interface FlexibleSpaceBarConfig {
  key?:Key;
  title?:FlutterWidget;
  background?:FlutterWidget;
  centerTitle?:boolean;
  titlePadding?:EdgeInsets;
  collapseMode?:CollapseMode;
}
export class FlexibleSpaceBar extends FlutterWidget {
  key?:Key;
  title?:FlutterWidget;
  background?:FlutterWidget;
  centerTitle?:boolean;
  titlePadding?:EdgeInsets;
  collapseMode?:CollapseMode;

  /**
   * @param config config: 
      {
        key?:Key, 
        title?:FlutterWidget, 
        background?:FlutterWidget, 
        centerTitle?:boolean, 
        titlePadding?:EdgeInsets, 
        collapseMode?:CollapseMode, 
      }
   */
  static new(config: FlexibleSpaceBarConfig) {
    var v = new FlexibleSpaceBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.title = config.title;
      v.background = config.background;
      v.centerTitle = config.centerTitle;
      v.titlePadding = config.titlePadding;
      v.collapseMode = config.collapseMode;
    }
    return v;
  }
}

//****** FlexibleSpaceBarSettings ******
interface FlexibleSpaceBarSettingsConfig {
  key?:Key;
  child:FlutterWidget;
  toolbarOpacity:number;
  minExtent:number;
  maxExtent:number;
  currentExtent:number;
}
export class FlexibleSpaceBarSettings extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  toolbarOpacity?:number;
  minExtent?:number;
  maxExtent?:number;
  currentExtent?:number;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        toolbarOpacity:number, 
        minExtent:number, 
        maxExtent:number, 
        currentExtent:number, 
      }
   */
  static new(config: FlexibleSpaceBarSettingsConfig) {
    var v = new FlexibleSpaceBarSettings();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.toolbarOpacity = config.toolbarOpacity;
      v.minExtent = config.minExtent;
      v.maxExtent = config.maxExtent;
      v.currentExtent = config.currentExtent;
      v.child = config.child;
    }
    return v;
  }
}

//****** FlutterLogo ******
interface FlutterLogoConfig {
  key?:Key;
  size?:number;
  textColor?:Color;
  style?:FlutterLogoStyle;
  duration?:Duration;
  curve?:Curve;
  
}
export class FlutterLogo extends FlutterWidget {
  key?:Key;
  size?:number;
  textColor?:Color;
  style?:FlutterLogoStyle;
  duration?:Duration;
  curve?:Curve;

  /**
   * @param config config: 
      {
        key?:Key, 
        size?:number, 
        textColor?:Color, 
        style?:FlutterLogoStyle, 
        duration?:Duration, 
        curve?:Curve, 
      }
   */
  static new(config: FlutterLogoConfig) {
    var v = new FlutterLogo();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.size = config.size;
      v.textColor = config.textColor;
      v.duration = config.duration;
      v.style = config.style;
      v.curve = config.curve;
    }
    return v;
  }
}

//****** FractionalTranslation ******
interface FractionalTranslationConfig {
  key?:Key;
  translation:Offset;
  transformHitTests?:boolean;
  child?:FlutterWidget;  
}
export class FractionalTranslation extends FlutterWidget {
  key?:Key;
  translation?:Offset;
  transformHitTests?:boolean;
  child?:FlutterWidget;  

  /**
   * @param config config: 
      {
        translation:Offset, 

        key?:Key, 
        transformHitTests?:boolean, 
        child?:FlutterWidget,   
      }
   */
  static new(config: FractionalTranslationConfig) {
    var v = new FractionalTranslation();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.transformHitTests = config.transformHitTests;
      v.translation = config.translation;
    }
    return v;
  }
}

//#endregion

//#region ------- G -------
//****** TODO GestureDetector ******
interface GestureDetectorConfig {
  child?:FlutterWidget;
  onTap?:VoidCallback;
  onTapDown?:any;
  onTapUp?:any;
  onTapCancel?:VoidCallback;
  onDoubleTap?:VoidCallback;
  onLongPress?:VoidCallback;
  onLongPressUp?:VoidCallback;
  onVerticalDragDown?:any;
  onVerticalDragStart?:any;
  onVerticalDragUpdate?:any;
  onVerticalDragEnd?:any;
  onVerticalDragCancel?:VoidCallback;
  onHorizontalDragDown?:any;
  onHorizontalDragStart?:any;
  onHorizontalDragUpdate?:any;
  onHorizontalDragEnd?:any;
  onHorizontalDragCancel?:VoidCallback;
  onPanDown?:any;
  onPanStart?:any;
  onPanUpdate?:any;
  onPanEnd?:any;
  onPanCancel?:VoidCallback;
  onScaleStart?:any;
  onScaleUpdate?:any;
  onScaleEnd?:any;
  behavior?:HitTestBehavior;
  excludeFromSemantics?:boolean;
  key?:Key;
}
export class GestureDetector extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  onTap?:VoidCallback;
  onTapDown?:any;
  onTapUp?:any;
  onTapCancel?:VoidCallback;
  onDoubleTap?:VoidCallback;
  onLongPress?:VoidCallback;
  onLongPressUp?:VoidCallback;
  onVerticalDragDown?:any;
  onVerticalDragStart?:any;
  onVerticalDragUpdate?:any;
  onVerticalDragEnd?:any;
  onVerticalDragCancel?:VoidCallback;
  onHorizontalDragDown?:any;
  onHorizontalDragStart?:any;
  onHorizontalDragUpdate?:any;
  onHorizontalDragEnd?:any;
  onHorizontalDragCancel?:VoidCallback;
  onPanDown?:any;
  onPanStart?:any;
  onPanUpdate?:any;
  onPanEnd?:any;
  onPanCancel?:VoidCallback;
  onScaleStart?:any;
  onScaleUpdate?:any;
  onScaleEnd?:any;
  behavior?:HitTestBehavior;
  excludeFromSemantics?:boolean;
  

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      onTap?:VoidCallback, 
      onTapDown?:any, 
      onTapUp?:any, 
      onTapCancel?:VoidCallback, 
      onDoubleTap?:VoidCallback, 
      onLongPress?:VoidCallback, 
      onLongPressUp?:VoidCallback, 
      onVerticalDragDown?:any, 
      onVerticalDragStart?:any, 
      onVerticalDragUpdate?:any, 
      onVerticalDragEnd?:any, 
      onVerticalDragCancel?:VoidCallback, 
      onHorizontalDragDown?:any, 
      onHorizontalDragStart?:any, 
      onHorizontalDragUpdate?:any, 
      onHorizontalDragEnd?:any, 
      onHorizontalDragCancel?:VoidCallback, 
      onPanDown?:any, 
      onPanStart?:any, 
      onPanUpdate?:any, 
      onPanEnd?:any, 
      onPanCancel?:VoidCallback, 
      onScaleStart?:any, 
      onScaleUpdate?:any, 
      onScaleEnd?:any, 
      behavior?:HitTestBehavior, 
      excludeFromSemantics?:boolean, 
    }
   */
  static new(config: GestureDetectorConfig) {

    var v = new GestureDetector();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.child = config.child;
        v.onTapDown = config.onTapDown;
        v.onTapUp = config.onTapUp;
        v.onTap = config.onTap;
        v.onTapCancel = config.onTapCancel;
        v.onDoubleTap = config.onDoubleTap;
        v.onLongPress = config.onLongPress;
        v.onLongPressUp = config.onLongPressUp;
        v.onVerticalDragDown = config.onVerticalDragDown;
        v.onVerticalDragStart = config.onVerticalDragStart;
        v.onVerticalDragUpdate = config.onVerticalDragUpdate;
        v.onVerticalDragEnd = config.onVerticalDragEnd;
        v.onVerticalDragCancel = config.onVerticalDragCancel;
        v.onHorizontalDragDown = config.onHorizontalDragDown;
        v.onHorizontalDragStart = config.onHorizontalDragStart;
        v.onHorizontalDragUpdate = config.onHorizontalDragUpdate;
        v.onHorizontalDragEnd = config.onHorizontalDragEnd;
        v.onHorizontalDragCancel = config.onHorizontalDragCancel;
        v.onPanDown = config.onPanDown;
        v.onPanStart = config.onPanStart;
        v.onPanUpdate = config.onPanUpdate;
        v.onPanEnd = config.onPanEnd;
        v.onPanCancel = config.onPanCancel;
        v.onScaleStart = config.onScaleStart;
        v.onScaleUpdate = config.onScaleUpdate;
        v.onScaleEnd = config.onScaleEnd;
        v.behavior = config.behavior;
        v.excludeFromSemantics = config.excludeFromSemantics;
      }
    return v;
  }
}

//****** GridTileBar ******
interface GridTileBarConfig {
  key?:Key;
  backgroundColor?:Color;
  leading?:FlutterWidget;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  trailing?:FlutterWidget;
}
export class GridTileBar extends FlutterWidget {
  key?:Key;
  backgroundColor?:Color;
  leading?:FlutterWidget;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  trailing?:FlutterWidget;

  /**
   * @param config config: 
    {
      key?:Key, 
      backgroundColor?:Color, 
      leading?:FlutterWidget, 
      title?:FlutterWidget, 
      subtitle?:FlutterWidget, 
      trailing?:FlutterWidget, 
    }
   */
  static new(config: GridTileBarConfig) {
    var v = new GridTileBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.backgroundColor = config.backgroundColor;
      v.leading = config.leading;
      v.title = config.title;
      v.subtitle = config.subtitle;
      v.trailing = config.trailing;
    }
    return v;
  }
}


//****** TODO GridTile ******
interface GridTileConfig {
  key?:Key;
  child?:FlutterWidget;
  header?:FlutterWidget;
  footer?:FlutterWidget;
}
export class GridTile extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  header?:FlutterWidget;
  footer?:FlutterWidget;

  /**
   * @param config config: 
    {
      key?:Key,
      child?:FlutterWidget,
      header?:FlutterWidget,
      footer?:FlutterWidget, 
    }
   */
  static new(config: GridTileConfig) {
    var v = new GridTile();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.header = config.header;
      v.footer = config.footer;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO GridPaper ******
interface GridPaperConfig {
  key?:Key;
  child?:FlutterWidget;
  color?:Color;
  divisions?:number;
  subdivisions?:number;
}
export class GridPaper extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  color?:Color;
  divisions?:number;
  subdivisions?:number;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        color?:Color, 
        divisions?:number, 
        subdivisions?:number, 
      }
   */
  static new(config: GridPaperConfig) {
    var v = new GridPaper();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.divisions = config.divisions;
      v.subdivisions = config.subdivisions;
      v.child = config.child;
    }
    return v;
  }
}

//#endregion

//#region ------- H -------
//#endregion

//#region ------- I -------
//****** InputDecorator ******
interface InputDecoratorConfig {
  key?:Key;
  child?:FlutterWidget;
  decoration:InputDecoration;
  baseStyle?:TextStyle;
  textAlign?:TextAlign;
  textAlignVertical?:TextAlignVertical;
  isFocused?:boolean;
  isHovering?:boolean;
  expands?:boolean;
  isEmpty?:boolean;
}
export class InputDecorator extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  decoration?:InputDecoration;
  baseStyle?:TextStyle;
  textAlign?:TextAlign;
  textAlignVertical?:TextAlignVertical;
  isFocused?:boolean;
  isHovering?:boolean;
  expands?:boolean;
  isEmpty?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        decoration:InputDecoration, 
        baseStyle?:TextStyle, 
        textAlign?:TextAlign, 
        textAlignVertical?:TextAlignVertical, 
        isFocused?:boolean, 
        isHovering?:boolean, 
        expands?:boolean, 
        isEmpty?:boolean, 
      }
   */
  static new(config: InputDecoratorConfig) {
    var v = new InputDecorator();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.decoration = config.decoration;
      v.baseStyle = config.baseStyle;
      v.textAlign = config.textAlign;
      v.textAlignVertical = config.textAlignVertical;
      v.isFocused = config.isFocused;
      v.isEmpty = config.isEmpty;
      v.isHovering = config.isHovering;
      v.expands = config.expands;
    }
    return v;
  }
}

//****** IndexedSemantics ******
interface IndexedSemanticsConfig {
  child?:FlutterWidget;
  index:number;
  key?:Key;
}
export class IndexedSemantics extends FlutterWidget {
  child?:FlutterWidget;
  index?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        index?:number,
      }
   */
  static new(config: IndexedSemanticsConfig) {
    var v = new IndexedSemantics();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.index = config.index;
      v.child = config.child;
    }
    return v;
  }
}

//****** IntrinsicHeight ******
interface IntrinsicHeightConfig {
  child?:FlutterWidget;
  key?:Key;
}
export class IntrinsicHeight extends FlutterWidget {
  child?:FlutterWidget;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget,         
      }
   */
  static new(config: IntrinsicHeightConfig) {
    var v = new IntrinsicHeight();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}

//****** IntrinsicWidth ******
interface IntrinsicWidthConfig {
  child?:FlutterWidget;
  stepWidth?:number;
  stepHeight?:number;
  key?:Key;
}
export class IntrinsicWidth extends FlutterWidget {
  child?:FlutterWidget;
  stepWidth?:number;
  stepHeight?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        stepWidth?:number, 
        stepHeight?:number, 
        key?:Key
      }
   */
  static new(config: IntrinsicWidthConfig) {
    var v = new IntrinsicWidth();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.stepWidth = config.stepWidth;
      v.stepHeight = config.stepHeight;
      v.child = config.child;
    }
    return v;
  }
}

//****** IndexedStack ******
interface IndexedStackConfig {
  children?:Array<FlutterWidget>;
  index?:number;
  alignment?:AlignmentDirectional;
  textDirection?:TextDirection;
  sizing?:StackFit;
  key?:Key;
}
export class IndexedStack extends FlutterWidget {
  children?:Array<FlutterWidget>;
  index?:number;
  alignment?:AlignmentDirectional;
  textDirection?:TextDirection;
  sizing?:StackFit;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>,
        index?:number,
        alignment?:AlignmentDirectional, 
        textDirection?:TextDirection, 
        sizing?:StackFit, 
        key?:Key, 
      }
   */
  static new(config: IndexedStackConfig) {
    var v = new IndexedStack();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.textDirection = config.textDirection;
      v.sizing = config.sizing;
      v.index = config.index;
      v.children = config.children;
    }
    return v;
  }
}

//****** IgnorePointer ******
interface IgnorePointerConfig {
  key?:Key;
  child?:FlutterWidget;
  ignoring?:boolean;
  ignoringSemantics?:boolean;
}
export class IgnorePointer extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  ignoring?:boolean;
  ignoringSemantics?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        ignoring?:boolean, 
        ignoringSemantics?:boolean, 
      }
   */
  static new(config: IgnorePointerConfig) {
    var v = new IgnorePointer();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.ignoring = config.ignoring;
      v.ignoringSemantics = config.ignoringSemantics;
    }
    return v;
  }
}

//****** IconButton ******
interface IconButtonConfig {
  key?:Key;
  icon:FlutterWidget;
  onPressed:VoidCallback;
  iconSize?:number;
  padding?:EdgeInsets;
  alignment?:Alignment;
  visualDensity?:VisualDensity;
  splashRadius?:number;
  color?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  disabledColor?:Color;
  autofocus?:boolean;
  tooltip?:string;
  enableFeedback?:boolean;
  constraints?:BoxConstraints;
}
export class IconButton extends FlutterWidget {
  key?:Key;
  icon?:FlutterWidget;
  onPressed?:VoidCallback;
  iconSize?:number;
  padding?:EdgeInsets;
  alignment?:Alignment;
  visualDensity?:VisualDensity;
  splashRadius?:number;
  color?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  disabledColor?:Color;
  autofocus?:boolean;
  tooltip?:string;
  enableFeedback?:boolean;
  constraints?:BoxConstraints;
  /**
   * @param config config: 
      {
        key?:Key, 
        icon:FlutterWidget, 
        onPressed:VoidCallback, 
        iconSize?:number, 
        padding?:EdgeInsets, 
        alignment?:Alignment, 
        visualDensity?:VisualDensity, 
        splashRadius?:number, 
        color?:Color, 
        focusColor?:Color, 
        hoverColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        disabledColor?:Color, 
        autofocus?:boolean, 
        tooltip?:string, 
        enableFeedback?:boolean,
        constraints?:BoxConstraints, 
      }
   */
  static new(config: IconButtonConfig) {
    var v = new IconButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.icon = config.icon;
      v.iconSize = config.iconSize;
      v.padding = config.padding;
      v.alignment = config.alignment;
      v.visualDensity = config.visualDensity;
      v.color = config.color;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.disabledColor = config.disabledColor;
      v.autofocus = config.autofocus;
      v.onPressed = config.onPressed;
      v.tooltip = config.tooltip;
      v.enableFeedback = config.enableFeedback;
      v.visualDensity = config.visualDensity;
      v.constraints = config.constraints;
    }
    return v;
  }
}

//****** Icon ******
interface IconConfig {
  key?:Key;
  size?:number;
  color?:Color;
  semanticLabel?:string;
  textDirection?:TextDirection;
  
}
export class Icon extends FlutterWidget {
  icon?:IconData;
  size?:number;
  color?:Color;
  semanticLabel?:string;
  textDirection?:TextDirection;
  key?:Key;
  
  /**
   * @param icon icon:IconData
   * @param config config: 
      {
        key?:Key,
        size?:number, 
        color?:Color, 
        semanticLabel?:string, 
        textDirection?:TextDirection,
      }
   */
  static new(icon:IconData,config?: IconConfig) {
    var v = new Icon();
    v.icon = icon;
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.size = config.size;
      v.color = config.color;
      v.semanticLabel = config.semanticLabel;
      v.textDirection = config.textDirection;
    }
    return v;
  }
}

//****** ImageIcon ******
interface ImageIconConfig {
  key?:Key;
  size?:number;
  color?:Color;
  semanticLabel?:string;
}
export class ImageIcon extends FlutterWidget {
  image?:ImageProvider;
  size?:number;
  color?:Color;
  semanticLabel?:string;
  key?:Key;
  
  /**
   * @param image image:ImageProvider
   * @param config config: 
      {
        key?:Key,
        size?:number, 
        color?:Color, 
        semanticLabel?:string, 
        textDirection?:TextDirection,
      }
   */
  static new(image:ImageProvider,config?: ImageIconConfig) {
    var v = new ImageIcon();
    v.image = image;
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.size = config.size;
      v.color = config.color;
      v.semanticLabel = config.semanticLabel;
    }
    return v;
  }
}


//#endregion

//#region ------- J -------
//#endregion

//#region ------- K -------
//****** KeyedSubtree ******
interface KeyedSubtreeConfig {
  child:FlutterWidget;
  key?:Key;
}
export class KeyedSubtree extends FlutterWidget {
  child?:FlutterWidget;
  key?:Key;

  /**
   * @param config config: 
      {
        child:FlutterWidget, 
        key?:Key,
      }
   */
  static new(config: KeyedSubtreeConfig) {
    var v = new KeyedSubtree();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}
//#endregion

//#region ------- L -------
//****** TODO LicensePage ******
interface LicensePageConfig {
  key?:Key;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  applicationIcon?:FlutterWidget;
}
export class LicensePage extends FlutterWidget {
  key?:Key;
  applicationName?:string;
  applicationLegalese?:string;
  applicationVersion?:string;
  applicationIcon?:FlutterWidget;
    
  /**
   * @param config config: 
      {
        key?:Key, 
        applicationName?:string, 
        applicationLegalese?:string, 
        applicationVersion?:string, 
        applicationIcon?:FlutterWidget, 
      }
   */
  static new(config: LicensePageConfig){
      var v = new LicensePage();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.applicationIcon = config.applicationIcon;
        v.applicationName = config.applicationName;
        v.applicationLegalese = config.applicationLegalese;
        v.applicationVersion = config.applicationVersion;
      }
      return v;
  }
}

//****** LimitedBox ******
interface LimitedBoxConfig {
  child?:FlutterWidget;
  maxWidth?:number;
  maxHeight?:number;
  key?:Key;
}
export class LimitedBox extends FlutterWidget {
  child?:FlutterWidget;
  maxWidth?:number;
  maxHeight?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        maxWidth?:number, 
        maxHeight?:number, 
        key?:Key,
      }
   */
  static new(config: LimitedBoxConfig) {
    var v = new LimitedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.maxWidth = config.maxWidth;
      v.maxHeight = config.maxHeight;
      v.child = config.child;
    }
    return v;
  }
}

//****** ListBody ******
interface ListBodyConfig {
  children?:Array<FlutterWidget>;
  reverse?:boolean;
  mainAxis?:Axis;
  key?:Key;
}
export class ListBody extends FlutterWidget {
  children?:Array<FlutterWidget>;
  reverse?:boolean;
  mainAxis?:Axis;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        reverse?:boolean, 
        mainAxis?:Axis, 
        key?:Key
      }
   */
  static new (config:ListBodyConfig) {
    var v = new ListBody();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.mainAxis = config.mainAxis;
      v.reverse = config.reverse;
      v.children = config.children;
    }
    return v;
  }
}

//****** ListTile ******
interface ListTileConfig {
  key?:Key;
  leading?:FlutterWidget;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  trailing?:FlutterWidget;
  onTap?:VoidCallback;
  onLongPress?:VoidCallback;
  selected?:boolean;
  isThreeLine?:boolean;
  dense?:boolean;
  visualDensity?:VisualDensity;
  shape?:ShapeBorder;
  contentPadding?:EdgeInsets;
  enabled?:boolean;
  focusColor?:Color;
  hoverColor?:Color;
  autofocus?:boolean;  
}
export class ListTile extends FlutterWidget {
  key?:Key;
  leading?:FlutterWidget;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  trailing?:FlutterWidget;
  onTap?:VoidCallback;
  onLongPress?:VoidCallback;
  selected?:boolean;
  isThreeLine?:boolean;
  dense?:boolean;
  visualDensity?:VisualDensity;
  shape?:ShapeBorder;
  contentPadding?:EdgeInsets;
  enabled?:boolean;
  focusColor?:Color;
  hoverColor?:Color;
  autofocus?:boolean; 

  /**
   * @param config config: 
      {
        key?:Key, 
        leading?:FlutterWidget, 
        title?:FlutterWidget, 
        subtitle?:FlutterWidget, 
        trailing?:FlutterWidget, 
        onTap?:VoidCallback, 
        onLongPress?:VoidCallback, 
        selected?:boolean, 
        isThreeLine?:boolean, 
        dense?:boolean, 
        visualDensity?:VisualDensity, 
        shape?:ShapeBorder, 
        contentPadding?:EdgeInsets, 
        enabled?:boolean, 
        focusColor?:Color, 
        hoverColor?:Color, 
        autofocus?:boolean,  
      }
   */
  static new(config: ListTileConfig) {
    var v = new ListTile();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.leading = config.leading;
      v.title = config.title;
      v.subtitle = config.subtitle;
      v.trailing = config.trailing;
      v.onTap = config.onTap;
      v.onLongPress = config.onLongPress;
      v.isThreeLine = config.isThreeLine;
      v.dense = config.dense;
      v.visualDensity = config.visualDensity;
      v.shape = config.shape;
      v.contentPadding = config.contentPadding;
      v.enabled = config.enabled;
      v.selected = config.selected;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.autofocus = config.autofocus;
    }
    return v;
  }
}

//****** TODO ListView ******
interface ListViewConfig {
  children?:Array<FlutterWidget>;
  padding?:EdgeInsets;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  primary?:boolean;
  physics?:ScrollPhysics;
  shrinkWrap?:boolean;
  itemExtent?:number;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  cacheExtent?:number;
  semanticChildCount?:number;
  dragStartBehavior?:DragStartBehavior;
  key?:Key;


  itemBuilder?:any;
  itemCount?:number;
}
export class ListView extends FlutterWidget {
  children?:Array<FlutterWidget>;
  padding?:EdgeInsets;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  primary?:boolean;
  physics?:ScrollPhysics;
  shrinkWrap?:boolean;
  itemExtent?:number;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  cacheExtent?:number;
  semanticChildCount?:number;
  dragStartBehavior?:DragStartBehavior;
  key?:Key;


  itemBuilder?:any;
  itemCount?:number;

  preBuild(jsWidgetHelper?:any, buildContext?:any) {
    if (this.itemBuilder) {
      this.children = [];
      if(this.itemCount!=null && this.itemCount!=undefined){
      for (let i = 0; i < this.itemCount; ++i) {
        let w = this.itemBuilder(buildContext, i);
        this.children.push(w);
      }
    }
      delete this.itemBuilder;
    }
    super.preBuild(jsWidgetHelper, buildContext);
  }

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        padding?:EdgeInsets, 
        controller?:ScrollController, 
        scrollDirection?:Axis, 
        reverse?:boolean,
        primary?:boolean, 
        physics?:ScrollPhysics, 
        shrinkWrap?:boolean, 
        itemExtent?:number,
        addAutomaticKeepAlives?:boolean, 
        addRepaintBoundaries?:boolean, 
        addSemanticIndexes?:boolean, 
        cacheExtent?:number,
        semanticChildCount?:number,
        dragStartBehavior?:DragStartBehavior, 
        key?:Key
      }
   */
  static new(config: ListViewConfig) {
    var v = new ListView();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.scrollDirection = config.scrollDirection;
      v.reverse = config.reverse;
      v.controller = config.controller;
      v.primary = config.primary;
      v.physics = config.physics;
      v.shrinkWrap = config.shrinkWrap;
      v.padding = config.padding;
      v.itemExtent = config.itemExtent;
      v.addAutomaticKeepAlives = config.addAutomaticKeepAlives;
      v.addRepaintBoundaries = config.addRepaintBoundaries;
      v.addSemanticIndexes = config.addSemanticIndexes;
      v.cacheExtent = config.cacheExtent;
      v.children = config.children;
      v.semanticChildCount = config.semanticChildCount;
      v.dragStartBehavior = config.dragStartBehavior;
    }
    return v;
  }

  /**
   * @param config config: 
      { itemBuilder?:any,
        itemCount?:number, 
        padding?:EdgeInsets, 
        controller?:ScrollController, 
        scrollDirection?:Axis, 
        reverse?:boolean,
        primary?:boolean, 
        physics?:ScrollPhysics, 
        shrinkWrap?:boolean, 
        itemExtent?:number,
        addAutomaticKeepAlives?:boolean, 
        addRepaintBoundaries?:boolean, 
        addSemanticIndexes?:boolean, 
        cacheExtent?:number,
        semanticChildCount?:number,
        dragStartBehavior?:DragStartBehavior, 
        key?:Key
      }
   */
  static builder(config: ListViewConfig) {
      let v = new ListView();
      v.constructorName = "builder";
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.scrollDirection = config.scrollDirection;
        v.reverse = config.reverse;
        v.controller = config.controller;
        v.primary = config.primary;
        v.physics = config.physics;
        v.shrinkWrap = config.shrinkWrap;
        v.padding = config.padding;
        v.itemExtent = config.itemExtent;
        v.itemBuilder = config.itemBuilder;
        v.itemCount = config.itemCount;
        v.addAutomaticKeepAlives = config.addAutomaticKeepAlives;
        v.addRepaintBoundaries = config.addRepaintBoundaries;
        v.addSemanticIndexes = config.addSemanticIndexes;
        v.cacheExtent = config.cacheExtent;
        v.semanticChildCount = config.semanticChildCount;
        v.dragStartBehavior = config.dragStartBehavior;
      }
      return v;
  }
}

//****** TODO LayoutBuilder ******
interface LayoutBuilderConfig{
  builder?:any;
  key?:Key;
}
export class LayoutBuilder extends FlutterWidget {
  builder?:any;
  key?:Key;

  /**
   * @param config config: 
      {
        builder?:any, 
        key?:Key
      }
   */
  static new (config: LayoutBuilderConfig) {
    var v = new LayoutBuilder();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.builder = config.builder;
    }
    return v;
  }
}
//#endregion

//#region ------- M -------
//****** TODO Material ******
interface MaterialConfig {
  child?:FlutterWidget;
  elevation?:number;
  color?:Color;
  shadowColor?:Color;
  textStyle?:TextStyle;
  borderRadius?:BorderRadius;
  type?:MaterialType;
  shape?:any;
  borderOnForeground?:boolean;
  clipBehavior?:Clip;
  animationDuration?:Duration;
  key?:Key;
}
export class Material extends FlutterWidget {
  child?:FlutterWidget;
  elevation?:number;
  color?:Color;
  shadowColor?:Color;
  textStyle?:TextStyle;
  borderRadius?:BorderRadius;
  type?:MaterialType;
  shape?:any;
  borderOnForeground?:boolean;
  clipBehavior?:Clip;
  animationDuration?:Duration;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        elevation?:number, 
        color?:Color, 
        shadowColor?:Color, 
        textStyle?:TextStyle,
        borderRadius?:BorderRadius, 
        type?:MaterialType, 
        shape?:any, 
        borderOnForeground?:boolean, 
        clipBehavior?:Clip,
        animationDuration?:Duration, 
        key?:Key,
      }
   */
  static new(config: MaterialConfig) {
    var v = new Material();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.type = config.type;
      v.elevation = config.elevation;
      v.color = config.color;
      v.shadowColor = config.shadowColor;
      v.textStyle = config.textStyle;
      v.borderRadius = config.borderRadius;
      v.shape = config.shape;
      v.borderOnForeground = config.borderOnForeground;
      v.clipBehavior = config.clipBehavior;
      v.animationDuration = config.animationDuration;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO MaterialPageRoute ******
interface MaterialPageRouteConfig {
  builder?:any;
  settings?:any;
  maintainState?:boolean;
  fullscreenDialog?:boolean;

  child?:MaterialPageRoute;
}
export class MaterialPageRoute extends FlutterWidget {
  builder?:any;
  settings?:any;
  maintainState?:boolean;
  fullscreenDialog?:boolean;

  child?:MaterialPageRoute;


  preBuild(jsWidgetHelper?:any, buildContext?:any) {
    if (this.builder) {
      this.child = this.builder(buildContext);
      delete this.builder;
    }

    super.preBuild(jsWidgetHelper, buildContext);
  }

  /**
   * @param config config: 
      {
        builder?:any, 
        settings?:any, 
        maintainState?:boolean, 
        fullscreenDialog?:boolean
      }
   */
  static new(config: MaterialPageRouteConfig) {
    var v = new MaterialPageRoute();
    if(config!=null && config!=undefined){
      v.builder = config.builder;
      v.settings = config.settings;
      v.maintainState = config.maintainState;
      v.fullscreenDialog = config.fullscreenDialog;
    }
    v.child = undefined;
    return v;
  }
}


//#endregion

//#region ------- N -------
//****** TODO NotificationListener ******
interface NotificationListenerConfig {
  child?:FlutterWidget;
  key?:Key;
}
export class NotificationListener extends FlutterWidget {
  child?:FlutterWidget;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget,
        key?:Key
      }
   */
  static new (config: NotificationListenerConfig) {
    var v = new NotificationListener();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO NestedScrollView ******
interface NestedScrollViewConfig {
  body?:FlutterWidget;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  physics?:ScrollPhysics;
  headerSliverBuilder?:any;
  dragStartBehavior?:DragStartBehavior;
  key?:Key;
  children?:Array<FlutterWidget>;
}
export class NestedScrollView extends FlutterWidget {
  body?:FlutterWidget;
  controller?:ScrollController;
  scrollDirection?:Axis;
  reverse?:boolean;
  physics?:ScrollPhysics;
  headerSliverBuilder?:any;
  dragStartBehavior?:DragStartBehavior;
  key?:Key;
  children?:Array<FlutterWidget>;
 
  preBuild(jsWidgetHelper?:any, buildContext?:any) {
    ///TODO: innerBoxIsScrolled 暂时不支持，默认为false
    if (this.headerSliverBuilder) {
      this.children = this.headerSliverBuilder(buildContext);
      delete this.headerSliverBuilder;
    }

    super.preBuild(jsWidgetHelper, buildContext);
  }

  /**
   * @param config config: 
      {
        body?:FlutterWidget, 
        controller?:ScrollController, 
        scrollDirection?:Axis, 
        reverse?:boolean,
        physics?:ScrollPhysics, 
        headerSliverBuilder?:any, 
        dragStartBehavior?:DragStartBehavior, 
        key?:Key
      }
   */
  static new(config: NestedScrollViewConfig) {
    var v = new NestedScrollView();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.controller = config.controller;
      v.scrollDirection = config.scrollDirection;
      v.reverse = config.reverse;
      v.physics = config.physics;
      v.headerSliverBuilder = config.headerSliverBuilder;
      v.body = config.body;
      v.dragStartBehavior = config.dragStartBehavior;
    }

    // 本地创建的，供flutter使用
    v.children = [];
    return v;
  }
}

//****** TODO NavigatorState ******
export class NavigatorState extends DartClass {
  context:any;

  push(t:any, materialPageRoute:MaterialPageRoute) {
    this.context.widget.helper.navigatorPush(materialPageRoute.builder(this.context));
  }
  pop(t:any,) {
    this.context.widget.helper.navigatorPop();
  }

  static new(context:any) {
      var v = new NavigatorState();
      v.context = context;
    return v;
  }
}

//****** TODO Navigator ******
interface NavigatorConfig {
  initialRoute?:string;
  onGenerateRoute?:any;
  onUnknownRoute?:any;
  observers?:any;
  key?:Key;
}
export class Navigator extends DartClass {
  initialRoute?:string;
  onGenerateRoute?:any;
  onUnknownRoute?:any;
  observers?:any;
  key?:Key;


  static push(context:any, materialPageRoute:MaterialPageRoute) {

    let t = null;
    if (arguments.length == 3) {
      t = arguments[0];
      context = arguments[1];
      materialPageRoute = arguments[2];
    }

    var navigatorState = NavigatorState.new(context);
    navigatorState.push(t, materialPageRoute);
  }

  static pop(context:any) {
    let t = null;
    if (arguments.length == 2) {
      t = arguments[0];
      context = arguments[1];
    }
    var navigatorState = NavigatorState.new(context);
    navigatorState.pop(t);
  }

  static of(context:any, opt:any) {
    var navigatorState =  NavigatorState.new(context);
    return navigatorState;
  }

  /**
   * @param config config: 
      {
        initialRoute?:string,
        onGenerateRoute?:any, 
        onUnknownRoute?:any, 
        observers?:any, 
        key?:Key
      }
   */
  static new (config: NavigatorConfig) {
    var v = new Navigator();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.initialRoute = config.initialRoute;
      v.onGenerateRoute = config.onGenerateRoute;
      v.onUnknownRoute = config.onUnknownRoute;
      v.observers = config.observers;
    }
    return v;
  }
}


//#endregion

//#region ------- O -------
//****** Opacity ******
interface OpacityConfig {
  key?:Key;
  child?:FlutterWidget;
  opacity:number;
  alwaysIncludeSemantics?:boolean;
}
export class Opacity extends FlutterWidget {
  child?:FlutterWidget;
  opacity?:number;
  alwaysIncludeSemantics?:boolean;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key,
        child?:FlutterWidget,
        opacity:number,
        alwaysIncludeSemantics?:boolean
      }
   */
  static new(config: OpacityConfig) {
    var v = new Opacity();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.opacity = config.opacity;
      v.alwaysIncludeSemantics = config.alwaysIncludeSemantics;
      v.child = config.child;
    }
    return v;
  }
}

//****** Offstage ******
interface OffstageConfig {
  child?:FlutterWidget;
  offstage?:boolean;
  key?:Key;
}
export class Offstage extends FlutterWidget {
  child?:FlutterWidget;
  offstage?:boolean;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:.FlutterWidget, 
        offstage?:boolean, 
        key?:Key, 
      }
   */
  static new (config: OffstageConfig) {
    var v = new Offstage();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.offstage = config.offstage;
      v.child = config.child;
    }
    return v;
  }
}

//****** OverflowBox ******
interface OverflowBoxConfig {
  child?:FlutterWidget;
  alignment?:Alignment;
  minWidth?:number;
  maxWidth?:number;
  minHeight?:number;
  maxHeight?:number;
  key?:Key;
}
export class OverflowBox extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  minWidth?:number;
  maxWidth?:number;
  minHeight?:number;
  maxHeight?:number;
  key?:Key;
  
  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        alignment?:Alignment, 
        minWidth?:number, 
        maxWidth?:number, 
        minHeight?:number, 
        maxHeight?:number, 
        key?:Key,
      }
   */
  static new(config: OverflowBoxConfig) {
    var v = new OverflowBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.minWidth = config.minWidth;
      v.maxWidth = config.maxWidth;
      v.minHeight = config.minHeight;
      v.maxHeight = config.maxHeight;
      v.child = config.child;
    }
    return v;
  }
}

//****** OutlineButton ******
interface OutlineButtonConfig {
  key?:Key;
  child?:FlutterWidget;
  onPressed:VoidCallback;
  onLongPress?:VoidCallback;
  padding?:EdgeInsets;
  textTheme?:ButtonTextTheme;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;  
  highlightElevation?:number;  
  focusColor?: Color;
  hoverColor?: Color;
  visualDensity?: VisualDensity;
  autofocus?: boolean;
  borderSide?:BorderSide;
  disabledBorderColor?:Color;
  highlightedBorderColor?:Color;

  icon?:FlutterWidget;
  label?:FlutterWidget;
}
export class OutlineButton extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  onPressed?:VoidCallback;
  onLongPress?:VoidCallback;
  padding?:EdgeInsets;
  textTheme?:ButtonTextTheme;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;  
  highlightElevation?:number;  
  focusColor?: Color;
  hoverColor?: Color;
  visualDensity?: VisualDensity;
  autofocus?: boolean;
  borderSide?:BorderSide;
  disabledBorderColor?:Color;
  highlightedBorderColor?:Color;
  icon?:FlutterWidget;
  label?:FlutterWidget;
  
  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        onPressed:VoidCallback, 
        onLongPress?:VoidCallback, 
        padding?:EdgeInsets, 
        textTheme?:ButtonTextTheme, 
        textColor?:Color, 
        disabledTextColor?:Color, 
        color?:Color, 
        disabledColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        colorBrightness?:Brightness, 
        shape?:any, 
        clipBehavior?:Clip, 
        materialTapTargetSize?:MaterialTapTargetSize,   
        highlightElevation?:number,   
        focusColor?: Color, 
        hoverColor?: Color, 
        visualDensity?: VisualDensity, 
        autofocus?: boolean, 
        borderSide?:BorderSide, 
        disabledBorderColor?:Color, 
        highlightedBorderColor?:Color, 
      }
   */
  static new(config: OutlineButtonConfig) {
    var v = new OutlineButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.textTheme = config.textTheme;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.highlightElevation = config.highlightElevation;
      v.padding = config.padding;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.visualDensity = config.visualDensity;
      v.autofocus = config.autofocus;
      v.child = config.child;
      v.borderSide = config.borderSide;
      v.disabledBorderColor = config.disabledBorderColor;
      v.highlightedBorderColor = config.highlightedBorderColor;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        onPressed?:VoidCallback, 
        onLongPress?:VoidCallback, 
        padding?:EdgeInsets, 
        textTheme?:ButtonTextTheme, 
        textColor?:Color, 
        disabledTextColor?:Color, 
        color?:Color, 
        disabledColor?:Color, 
        highlightColor?:Color, 
        splashColor?:Color, 
        colorBrightness?:Brightness, 
        shape?:any, 
        clipBehavior?:Clip, 
        materialTapTargetSize?:MaterialTapTargetSize,   
        highlightElevation?:number,   
        focusColor?: Color, 
        hoverColor?: Color, 
        visualDensity?: VisualDensity, 
        autofocus?: boolean, 
        borderSide?:BorderSide, 
        disabledBorderColor?:Color, 
        highlightedBorderColor?:Color, 

        icon?:FlutterWidget, 
        label?:FlutterWidget, 
      }
   */
  static icon(config: OutlineButtonConfig) {
    let v = new OutlineButton();
    v.constructorName = "icon";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.textTheme = config.textTheme;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.padding = config.padding;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.autofocus = config.autofocus;
      v.borderSide = config.borderSide;
      v.disabledBorderColor = config.disabledBorderColor;
      v.highlightedBorderColor = config.highlightedBorderColor;
      v.icon = config.icon;
      v.label = config.label;
    }
    return v;
  }
}
//#endregion

//#region ------- P -------
//****** Padding ******
interface PaddingConfig {
  child?:FlutterWidget;
  padding:EdgeInsets;
  key?:Key;
}
export class Padding extends FlutterWidget {
  child?:FlutterWidget;
  padding?:EdgeInsets;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        padding?:EdgeInsets, 
        key?:Key
      }
   */
  static new(config: PaddingConfig) {
    var v = new Padding();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.padding = config.padding;
      v.child = config.child;
    }
    return v;
  }
}

//****** PhysicalModel ******
interface PhysicalModelConfig {
  key?:Key;
  color:Color;
  shape?:BoxShape;
  child?:FlutterWidget;
  clipBehavior?:Clip;
  borderRadius?:BorderRadius;
  elevation?:number;
  shadowColor?:Color;
}
export class PhysicalModel extends FlutterWidget {
  key?:Key;
  color?:Color;
  shape?:BoxShape;
  child?:FlutterWidget;
  clipBehavior?:Clip;
  borderRadius?:BorderRadius;
  elevation?:number;
  shadowColor?:Color;

  /**
   * @param config config: 
      {
        key?:Key, 
        color:Color, 
        shape?:BoxShape, 
        child?:FlutterWidget, 
        clipBehavior?:Clip, 
        borderRadius?:BorderRadius, 
        elevation?:number, 
        shadowColor?:Color, 
      }
   */
  static new(config: PhysicalModelConfig) {
    var v = new PhysicalModel();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.color = config.color;
      v.shape = config.shape;
      v.shadowColor = config.shadowColor;
      v.clipBehavior = config.clipBehavior;
      v.elevation = config.elevation;
    }
    return v;
  }
}

//****** Positioned ******
interface PositionedConfig {
  key?:Key;
  child:FlutterWidget;
  start?:number;
  left?:number;
  top?:number;
  end?:number;
  right?:number;
  bottom?:number;
  width?:number;
  height?:number;  
  rect?:Rect;
  textDirection?:TextDirection;
}
export class Positioned extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  start?:number;
  left?:number;
  top?:number;
  end?:number;
  right?:number;
  bottom?:number;
  width?:number;
  height?:number;  
  rect?:Rect;
  textDirection?:TextDirection;
  
  /**
   * @param config config: 
      {
        key?:Key
        child:FlutterWidget,
        left?:number,
        top?:number,
        right?:number,
        bottom?:number,
        width?:number,
        height?:number,        
      }
   */
  static new(config: PositionedConfig) {
    var v = new Positioned();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.width = config.width;
      v.height = config.height;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        child:FlutterWidget, 
        rect?:Rect, 
        key?:Key
      }
   */
  static fromRect (config: PositionedConfig) {
    let v = new Positioned();
    v.constructorName = "fromRect";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.rect = config.rect;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        key?:Key
        child:FlutterWidget,
        left?:number,
        top?:number,
        right?:number,
        bottom?:number, 
      }
   */
  static fill(config: PositionedConfig) {
    var v = new Positioned();
    v.constructorName = "fill";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        key?:Key
        child:FlutterWidget,
        textDirection:TextDirection;
        start?:number,
        top?:number,
        end?:number,
        bottom?:number,
        width?:number,
        height?:number,        
      }
   */
  static directional(config: PositionedConfig) {
    var v = new Positioned();
    v.constructorName = "directional";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.textDirection = config.textDirection;
      v.start = config.start;
      v.top = config.top;
      v.end = config.end;
      v.bottom = config.bottom;
      v.width = config.width;
      v.height = config.height;
      v.child = config.child;
    }
    return v;
  }

}

//****** PositionedDirectional ******
interface PositionedDirectionalConfig {
  key?:Key;
  child:FlutterWidget;
  start?:number;
  top?:number;
  end?:number;
  bottom?:number;
  width?:number;
  height?:number;  
}
export class PositionedDirectional extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  start?:number;
  top?:number;
  end?:number;
  bottom?:number;
  width?:number;
  height?:number;  
  
  /**
   * @param config config: 
      {
        key?:Key
        child:FlutterWidget,
        start?:number,
        top?:number,
        end?:number,
        bottom?:number,
        width?:number,
        height?:number,        
      }
   */
  static new(config: PositionedDirectionalConfig) {
    var v = new PositionedDirectional();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.start = config.start;
      v.top = config.top;
      v.end = config.end;
      v.bottom = config.bottom;
      v.width = config.width;
      v.height = config.height;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO PreferredSize ******
interface PreferredSizeConfig {
  key?:Key;
  child?:FlutterWidget;
  preferredSize?:Size;
}
export class PreferredSize extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  preferredSize?:Size;
  
  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        preferredSize?:Size, 
        key?:Key
      }
   */
  static new (config:PreferredSizeConfig) {
    var v = new PreferredSize();
    if(config!=null && config!=undefined){
      v.key =  config.key;
      v.child =  config.child;
      v.preferredSize =  config.preferredSize;
    }
    return v;
  }
}

//****** TODO PreferredSize ******
export class PreferredSizeWidget extends FlutterWidget {
  static new() {
    return new PreferredSizeWidget();
  }
}

//****** TODO Placeholder ******
interface PlaceholderConfig {
  color?:Color;
  strokeWidth?:number;
  fallbackWidth?:number;
  fallbackHeight?:number;
  key?:Key;
}
export class Placeholder extends FlutterWidget {
  color?:Color;
  strokeWidth?:number;
  fallbackWidth?:number;
  fallbackHeight?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        color?:Color, 
        strokeWidth?:number, 
        fallbackWidth?:number, 
        fallbackHeight?:number, 
        key?:Key,
      }
   */
  static new(config: PlaceholderConfig) {
    var v = new Placeholder();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.strokeWidth = config.strokeWidth;
      v.fallbackWidth = config.fallbackWidth;
      v.fallbackHeight = config.fallbackHeight;
    }
    return v;
  }
}

//****** TODO PopupMenuButton ******
interface PopupMenuButtonConfig {
  itemBuilder?:any;
  initialValue?:any;
  onSelected?:any;
  onCanceled?:any;
  tooltip?:string;
  elevation?:number;
  padding?:EdgeInsets;
  child?:FlutterWidget;
  icon?:FlutterWidget;
  offset?:Offset;
  key?:Key;
  children?:Array<FlutterWidget>;
}
export class PopupMenuButton extends FlutterWidget {
  itemBuilder?:any;
  initialValue?:any;
  onSelected?:any;
  onCanceled?:any;
  tooltip?:string;
  elevation?:number;
  padding?:EdgeInsets;
  child?:FlutterWidget;
  icon?:FlutterWidget;
  offset?:Offset;
  key?:Key;
  children?:Array<FlutterWidget>;

  //在生成json前调用
  //用于list delegate 等的items build
  //用于 widget 有类似 onTab 等响应函数变量，在此转换成 callback id,
  //但注意，delegate 中确实需要 function ,不需要转ID的，不要调用super.preBuild
  preBuild(jsWidgetHelper:any, buildContext:any) {
    //先把调用函数
    if (this.itemBuilder) {
      this.children = this.itemBuilder(buildContext);
      delete this.itemBuilder;
    }

    //function 转 id
    super.preBuild(jsWidgetHelper, buildContext);
  }

  /**
   * @param config config: 
      {
        itemBuilder?:any, 
        initialValue?:any, 
        onSelected?:any, 
        onCanceled?:any, 
        tooltip?:string, 
        elevation?:number, 
        padding?:EdgeInsets, 
        child?:FlutterWidget, 
        icon?:FlutterWidget, 
        offset?:Offset, 
        key?:Key
      }
   */
  static new(config: PopupMenuButtonConfig) {
    var v = new PopupMenuButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.itemBuilder = config.itemBuilder;
      v.initialValue = config.initialValue;
      v.onSelected = config.onSelected;
      v.onCanceled = config.onCanceled;
      v.tooltip = config.tooltip;
      v.elevation = config.elevation;
      v.padding = config.padding;
      v.child = config.child;
      v.icon = config.icon;
      v.offset = config.offset;
    }
    // 本地创建的，供flutter使用
    v.children = [];
    return v;
  }
}

//****** TODO PopupMenuItem ******
interface PopupMenuItemConfig {
  child?:FlutterWidget;
  value?:any;
  enabled?:boolean;
  height?:number;
  key?:Key;
}
export class PopupMenuItem extends FlutterWidget {
  child?:FlutterWidget;
  value?:any;
  enabled?:boolean;
  height?:number;
  key?:Key;

  /**
   * @param config config: 
      {
        child?:FlutterWidget, 
        value?:any, 
        enabled?:boolean, 
        height?:number, 
        key?:Key
      }
   */
  static new(config: PopupMenuItemConfig) {
    var v = new PopupMenuItem();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.enabled = config.enabled;
      v.height = config.height;
      v.child = config.child;
    }
    return v;
  }
}
//#endregion

//#region ------- R -------
//****** Row ******
interface RowConfig {
  children?:Array<FlutterWidget>;
  mainAxisAlignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  crossAxisAlignment?:CrossAxisAlignment;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
  key?:Key;
}
export class Row extends FlutterWidget {
  children?:Array<FlutterWidget>;
  mainAxisAlignment?:MainAxisAlignment;
  mainAxisSize?:MainAxisSize;
  crossAxisAlignment?:CrossAxisAlignment;
  textDirection?:TextDirection;
  verticalDirection?:VerticalDirection;
  textBaseline?:TextBaseline;
  key?:Key;

  /**
   * @param config config: 
      {
        children?:Array<FlutterWidget>, 
        mainAxisAlignment?:MainAxisAlignment, 
        mainAxisSize?:MainAxisSize, 
        crossAxisAlignment?:CrossAxisAlignment,
        textDirection?:TextDirection, 
        verticalDirection?:VerticalDirection, 
        textBaseline?:TextBaseline, 
        key?:Key,
      }
   */
  static new(config: RowConfig) {
    var v = new Row();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.mainAxisAlignment = config.mainAxisAlignment;
      v.mainAxisSize = config.mainAxisSize;
      v.crossAxisAlignment = config.crossAxisAlignment;
      v.textDirection = config.textDirection;
      v.verticalDirection = config.verticalDirection;
      v.textBaseline = config.textBaseline;
      v.children = config.children;
    }
    return v;
  }
}

//****** RepaintBoundary ******
interface RepaintBoundaryConfig {
  key?:Key;
  child?:FlutterWidget;
}
export class RepaintBoundary extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  childIndex?:number;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget,
      }
   */
  static new(config: RepaintBoundaryConfig) {
    var v = new RepaintBoundary();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }

  static wrap(child:FlutterWidget,childIndex:number) {
    var v = new RepaintBoundary();
    v.constructorName = "wrap";
    v.child = child;
    v.childIndex = childIndex;
    return v;
  }
}

//****** RawImage ******
interface RawImageConfig {
  key?:Key;
  image?:ImageProvider;
  debugImageLabel?:string;
  width?:number;
  height?:number;
  scale?:number;
  color?:Color;
  colorBlendMode?:BlendMode;
  fit?:BoxFit;
  alignment?:Alignment;
  repeat?:ImageRepeat;
  centerSlice?:Rect;
  matchTextDirection?:boolean;
  invertColors?:boolean;
  filterQuality?:FilterQuality;
  isAntiAlias?:boolean;
}
export class RawImage extends FlutterWidget {
  key?:Key;
  image?:ImageProvider;
  debugImageLabel?:string;
  width?:number;
  height?:number;
  scale?:number;
  color?:Color;
  colorBlendMode?:BlendMode;
  fit?:BoxFit;
  alignment?:Alignment;
  repeat?:ImageRepeat;
  centerSlice?:Rect;
  matchTextDirection?:boolean;
  invertColors?:boolean;
  filterQuality?:FilterQuality;
  isAntiAlias?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        image?:ImageProvider, 
        debugImageLabel?:string, 
        width?:number, 
        height?:number, 
        scale?:number, 
        color?:Color, 
        colorBlendMode?:BlendMode, 
        fit?:BoxFit, 
        alignment?:Alignment, 
        repeat?:ImageRepeat, 
        centerSlice?:Rect, 
        matchTextDirection?:boolean, 
        invertColors?:boolean, 
        filterQuality?:FilterQuality, 
        isAntiAlias?:boolean, 
      }
   */
  static new(config: RawImageConfig) {
    var v = new RawImage();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.image = config.image;
      v.debugImageLabel = config.debugImageLabel;
      v.width = config.width;
      v.height = config.height;
      v.scale = config.scale;
      v.color = config.color;
      v.colorBlendMode = config.colorBlendMode;
      v.fit = config.fit;
      v.alignment = config.alignment;
      v.repeat = config.repeat;
      v.centerSlice = config.centerSlice;
      v.matchTextDirection = config.matchTextDirection;
      v.invertColors = config.invertColors;
      v.filterQuality = config.filterQuality;
      v.isAntiAlias = config.isAntiAlias;
    }
    return v;
  }
}

//****** RotatedBox ******
interface RotatedBoxConfig {
  key?:Key;
  quarterTurns:number;
  child?:FlutterWidget;
}
export class RotatedBox extends FlutterWidget {
  key?:Key;
  quarterTurns?:number;
  child?:FlutterWidget;

  /**
   * @param config config: 
      {
        key?:Key, 
        quarterTurns:number, 
        child?:FlutterWidget, 
      }
   */
  static new(config: RotatedBoxConfig) {
    var v = new RotatedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.quarterTurns = config.quarterTurns;
    }
    return v;
  }
}

//****** TODO RaisedButton ******
interface RaisedButtonConfig {
  child?:FlutterWidget;
  onPressed?:VoidCallback;
  onHighlightChanged?:VoidValueChangedBoolean;
  padding?:EdgeInsets;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  elevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  animationDuration?:Duration;
  key?:Key;

  icon?:FlutterWidget;
  label?:FlutterWidget;
  onLongPress?:VoidCallback;
  focusColor?:Color;
  hoverColor?:Color;
  focusElevation?:number;
  hoverElevation?:number;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
}
export class RaisedButton extends FlutterWidget {
  child?:FlutterWidget;
  onPressed?:VoidCallback;
  onHighlightChanged?:VoidValueChangedBoolean;
  padding?:EdgeInsets;
  textColor?:Color;
  disabledTextColor?:Color;
  color?:Color;
  disabledColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  colorBrightness?:Brightness;
  elevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  animationDuration?:Duration;
  key?:Key;

  icon?:FlutterWidget;
  label?:FlutterWidget;

  onLongPress?:VoidCallback;
  focusColor?:Color;
  hoverColor?:Color;
  focusElevation?:number;
  hoverElevation?:number;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
  
  /**
   * @param config config: 
      {
        key?:Key,
        child?:FlutterWidget, 
        onPressed?:VoidCallback, 
        onHighlightChanged?:VoidValueChangedBoolean, 
        padding?:EdgeInsets,
        textColor?:Color, 
        disabledTextColor?:Color, 
        color?:Color, 
        disabledColor?:Color,
        highlightColor?:Color, 
        splashColor?:Color, 
        colorBrightness?:Brightness, 
        elevation?:number,
        highlightElevation?:number, 
        disabledElevation?:number, 
        shape?:any, 
        clipBehavior?:Clip,
        materialTapTargetSize?:MaterialTapTargetSize, 
        animationDuration?:Duration, 
      
        onLongPress?:VoidCallback, 
        focusColor?:Color, 
        hoverColor?:Color, 
        focusElevation?:number, 
        hoverElevation?:number, 
        visualDensity?:VisualDensity, 
        autofocus?:boolean,
      }
   */
  static new(config: RaisedButtonConfig) {
    var v = new RaisedButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.onHighlightChanged = config.onHighlightChanged;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.elevation = config.elevation;
      v.highlightElevation = config.highlightElevation;
      v.disabledElevation = config.disabledElevation;
      v.padding = config.padding;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.animationDuration = config.animationDuration;
      v.child = config.child;
      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.focusElevation = config.focusElevation;
      v.hoverElevation = config.hoverElevation;
      v.visualDensity = config.visualDensity;
      v.autofocus = config.autofocus;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key,
      icon?:FlutterWidget, 
      label?:FlutterWidget,
      onPressed?:VoidCallback, 
      onHighlightChanged?:VoidValueChangedBoolean, 
      padding?:EdgeInsets,
      textColor?:Color, 
      disabledTextColor?:Color, 
      color?:Color, 
      disabledColor?:Color,
      highlightColor?:Color, 
      splashColor?:Color, 
      colorBrightness?:Brightness, 
      elevation?:number, 
      highlightElevation?:number, 
      disabledElevation?:number, 
      shape?:any, 
      clipBehavior?:Clip, 
      materialTapTargetSize?:MaterialTapTargetSize, 
      animationDuration?:Duration, 
      onLongPress?:VoidCallback, 
      focusColor?:Color, 
      hoverColor?:Color, 
      focusElevation?:number, 
      hoverElevation?:number, 
      visualDensity?:VisualDensity, 
      autofocus?:boolean,
    }
   */
  static icon(config: RaisedButtonConfig) {
    let v = new RaisedButton();
    v.constructorName = "icon";
    if(config!=null && config!=undefined){
    {
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.padding = config.padding;
      v.onHighlightChanged = config.onHighlightChanged;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.colorBrightness = config.colorBrightness;
      v.elevation = config.elevation;
      v.highlightElevation = config.highlightElevation;
      v.disabledElevation = config.disabledElevation;
      v.shape = config.shape;
      v.clipBehavior = config.clipBehavior;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.animationDuration = config.animationDuration;
      v.icon = config.icon;
      v.label = config.label;

      v.onLongPress = config.onLongPress;
      v.focusColor = config.focusColor;
      v.hoverColor = config.hoverColor;
      v.autofocus = config.autofocus;
    }
    return v;
  }
  }
}

//****** TODO RaisedButton ******
interface RadioConfig {
  key?:Key;
  value?:any;
  groupValue?:any;
  onChanged?:any;
  activeColor?:Color;
  materialTapTargetSize?:MaterialTapTargetSize;
  
}
export class Radio extends FlutterWidget {
  key?:Key;
  value?:any;
  groupValue?:any;
  onChanged?:any;
  activeColor?:Color;
  materialTapTargetSize?:MaterialTapTargetSize;

  /**
   * @param config config: 
    {
      key?:Key,
      value?:any,
      groupValue?:any,
      onChanged?:any,
      activeColor?:Color,
      materialTapTargetSize?:MaterialTapTargetSize
    }
   */
  static new(config: RadioConfig) {
    var v = new Radio();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.groupValue = config.groupValue;
      v.onChanged = config.onChanged;
      v.activeColor = config.activeColor;
      v.materialTapTargetSize = config.materialTapTargetSize;
    }
    return v;
  }
}

//****** RaisedButton ******
interface RawMaterialButtonConfig {
  key?:Key;  
  onPressed:VoidCallback;
  onLongPress?:VoidCallback;
  onHighlightChanged?:VoidValueChangedBoolean;
  textStyle?:TextStyle;
  padding?:EdgeInsets;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  constraints?:BoxConstraints;
  elevation?:number;
  focusElevation?:number;
  hoverElevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  animationDuration?:Duration;
  enableFeedback?:boolean;
  child?:FlutterWidget;
}
export class RawMaterialButton extends FlutterWidget {
  key?:Key;  
  onPressed?:VoidCallback;
  onLongPress?:VoidCallback;
  onHighlightChanged?:VoidValueChangedBoolean;
  textStyle?:TextStyle;
  padding?:EdgeInsets;
  fillColor?:Color;
  focusColor?:Color;
  hoverColor?:Color;
  highlightColor?:Color;
  splashColor?:Color;
  constraints?:BoxConstraints;
  elevation?:number;
  focusElevation?:number;
  hoverElevation?:number;
  highlightElevation?:number;
  disabledElevation?:number;
  visualDensity?:VisualDensity;
  autofocus?:boolean;
  shape?:any;
  clipBehavior?:Clip;
  materialTapTargetSize?:MaterialTapTargetSize;
  animationDuration?:Duration;
  enableFeedback?:boolean;
  child?:FlutterWidget;

  /**
   * @param config config: 
    {
      key?:Key,   
      onPressed:VoidCallback, 
      onLongPress?:VoidCallback, 
      onHighlightChanged?:VoidValueChangedBoolean, 
      textStyle?:TextStyle, 
      padding?:EdgeInsets, 
      fillColor?:Color, 
      focusColor?:Color, 
      hoverColor?:Color, 
      highlightColor?:Color, 
      splashColor?:Color, 
      constraints?:BoxConstraints, 
      elevation?:number, 
      focusElevation?:number, 
      hoverElevation?:number, 
      highlightElevation?:number, 
      disabledElevation?:number, 
      visualDensity?:VisualDensity, 
      autofocus?:boolean, 
      shape?:any, 
      clipBehavior?:Clip, 
      materialTapTargetSize?:MaterialTapTargetSize, 
      animationDuration?:Duration, 
      enableFeedback?:boolean, 
      child?:FlutterWidget, 
    }
   */
  static new(config: RawMaterialButtonConfig) {
    var v = new RawMaterialButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.onPressed = config.onPressed;
      v.onLongPress = config.onLongPress;
      v.onHighlightChanged = config.onHighlightChanged;
      v.focusColor = config.focusColor;
      v.focusElevation = config.focusElevation;
      v.hoverColor = config.hoverColor;
      v.hoverElevation = config.hoverElevation;
      v.textStyle = config.textStyle;
      v.fillColor = config.fillColor;
      v.highlightColor = config.highlightColor;
      v.splashColor = config.splashColor;
      v.elevation = config.elevation;
      v.highlightElevation = config.highlightElevation;
      v.disabledElevation = config.disabledElevation;
      v.padding = config.padding;
      v.visualDensity = config.visualDensity;
      v.constraints = config.constraints;
      v.shape = config.shape;
      v.animationDuration = config.animationDuration;
      v.clipBehavior = config.clipBehavior;
      v.autofocus = config.autofocus;
      v.enableFeedback = config.enableFeedback;
      v.materialTapTargetSize = config.materialTapTargetSize;
      v.child = config.child;
    }
    return v;
  }
}

//****** RichText ******
interface RichTextConfig {
  key?:Key;
  text:FlutterWidget;
  textAlign?:TextAlign;
  textDirection?:TextDirection;
  softWrap?:boolean;
  overflow?:Overflow;
  textScaleFactor?:number;
  maxLines?:number;
  textWidthBasis?:TextWidthBasis;
  
}
export class RichText extends FlutterWidget {
  text?:TextSpan;
  textAlign?:TextAlign;
  textDirection?:TextDirection;
  softWrap?:boolean;
  overflow?:Overflow;
  textScaleFactor?:number;
  maxLines?:number;
  key?:Key;
  textWidthBasis?:TextWidthBasis;

  /**
   * @param config config: 
    {
      key?:Key, 
      text:FlutterWidget, 
      textAlign?:TextAlign, 
      textDirection?:TextDirection, 
      softWrap?:boolean, 
      overflow?:Overflow, 
      textScaleFactor?:number, 
      maxLines?:number, 
      textWidthBasis?:TextWidthBasis, 
    }
   */
  static new (config: RichTextConfig) {
    var v= new RichText();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.text = config.text;
      v.textAlign = config.textAlign;
      v.textDirection = config.textDirection;
      v.softWrap = config.softWrap;
      v.overflow = config.overflow;
      v.textScaleFactor = config.textScaleFactor;
      v.maxLines = config.maxLines;
      v.textWidthBasis = config.textWidthBasis;
    }
    return v;
  }
}
//#endregion

//#region ------- S -------

//****** Spacer ******
interface SpacerConfig {
  flex?:number;
  key?:Key;
}
export class Spacer extends FlutterWidget {
  key?:Key;
  flex?:number;

  /**
   * @param config config: 
    {
      key?:Key,
      flex?:number
    }
   */
  static new(config: SpacerConfig) {
    var v = new Spacer();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.flex = config.flex;
    }
    return v;
  }

}

//****** Semantics ******
interface SemanticsConfig {
  key?:Key;
  child?:FlutterWidget;
  container?:boolean;
  explicitChildNodes?:boolean;
  excludeSemantics?:boolean;
  enabled?:boolean;
  checked?:boolean;
  selected?:boolean;
  toggled?:boolean;
  button?:boolean;
  link?:boolean;
  header?:boolean;
  textField?:boolean;
  readOnly?:boolean;
  focusable?:boolean;
  focused?:boolean;
  inMutuallyExclusiveGroup?:boolean;
  obscured?:boolean;
  multiline?:boolean;
  scopesRoute?:boolean;
  namesRoute?:boolean;
  hidden?:boolean;
  image?:boolean;
  liveRegion?:boolean;
  maxValueLength?:number;
  currentValueLength?:number;

  label?:string;
  value?:string;
  increasedValue?:string;
  decreasedValue?:string;
  hint?:string;
  onTapHint?:string;
  onLongPressHint?:string;
  textDirection?:TextDirection;

  onTap?:VoidCallback;
  onLongPress?:VoidCallback;
  onScrollLeft?:VoidCallback;
  onScrollRight?:VoidCallback;
  onScrollUp?:VoidCallback;
  onScrollDown?:VoidCallback;
  onIncrease?:VoidCallback;
  onDecrease?:VoidCallback;
  onCopy?:VoidCallback;
  onCut?:VoidCallback;
  onPaste?:VoidCallback;
  onDismiss?:VoidCallback;
  onDidGainAccessibilityFocus?:VoidCallback;
  onDidLoseAccessibilityFocus?:VoidCallback;
}
export class Semantics extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  container?:boolean;
  explicitChildNodes?:boolean;
  excludeSemantics?:boolean;
  enabled?:boolean;
  checked?:boolean;
  selected?:boolean;
  toggled?:boolean;
  button?:boolean;
  link?:boolean;
  header?:boolean;
  textField?:boolean;
  readOnly?:boolean;
  focusable?:boolean;
  focused?:boolean;
  inMutuallyExclusiveGroup?:boolean;
  obscured?:boolean;
  multiline?:boolean;
  scopesRoute?:boolean;
  namesRoute?:boolean;
  hidden?:boolean;
  image?:boolean;
  liveRegion?:boolean;
  maxValueLength?:number;
  currentValueLength?:number;

  label?:string;
  value?:string;
  increasedValue?:string;
  decreasedValue?:string;
  hint?:string;
  onTapHint?:string;
  onLongPressHint?:string;
  textDirection?:TextDirection;

  onTap?:VoidCallback;
  onLongPress?:VoidCallback;
  onScrollLeft?:VoidCallback;
  onScrollRight?:VoidCallback;
  onScrollUp?:VoidCallback;
  onScrollDown?:VoidCallback;
  onIncrease?:VoidCallback;
  onDecrease?:VoidCallback;
  onCopy?:VoidCallback;
  onCut?:VoidCallback;
  onPaste?:VoidCallback;
  onDismiss?:VoidCallback;
  onDidGainAccessibilityFocus?:VoidCallback;
  onDidLoseAccessibilityFocus?:VoidCallback;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      container?:boolean, 
      explicitChildNodes?:boolean, 
      excludeSemantics?:boolean, 
      enabled?:boolean, 
      checked?:boolean, 
      selected?:boolean, 
      toggled?:boolean, 
      button?:boolean, 
      link?:boolean, 
      header?:boolean, 
      textField?:boolean, 
      readOnly?:boolean, 
      focusable?:boolean, 
      focused?:boolean, 
      inMutuallyExclusiveGroup?:boolean, 
      obscured?:boolean, 
      multiline?:boolean, 
      scopesRoute?:boolean, 
      namesRoute?:boolean, 
      hidden?:boolean, 
      image?:boolean, 
      liveRegion?:boolean, 
      maxValueLength?:number, 
      currentValueLength?:number, 

      label?:string, 
      value?:string, 
      increasedValue?:string, 
      decreasedValue?:string, 
      hint?:string, 
      onTapHint?:string, 
      onLongPressHint?:string, 
      textDirection?:TextDirection, 

      onTap?:VoidCallback, 
      onLongPress?:VoidCallback, 
      onScrollLeft?:VoidCallback, 
      onScrollRight?:VoidCallback, 
      onScrollUp?:VoidCallback, 
      onScrollDown?:VoidCallback, 
      onIncrease?:VoidCallback, 
      onDecrease?:VoidCallback, 
      onCopy?:VoidCallback, 
      onCut?:VoidCallback, 
      onPaste?:VoidCallback, 
      onDismiss?:VoidCallback, 
      onDidGainAccessibilityFocus?:VoidCallback, 
      onDidLoseAccessibilityFocus?:VoidCallback, 
    }
   */
  static new(config: SemanticsConfig) {
    var v = new Semantics();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;

      v.container = config.container;
      v.excludeSemantics = config.excludeSemantics;
      v.explicitChildNodes = config.explicitChildNodes;
      v.enabled = config.enabled;
      v.checked = config.checked;
      v.selected = config.selected;
      v.toggled = config.toggled;
      v.button = config.button;
      v.link = config.link;
      v.header = config.header;
      v.textField = config.textField;
      v.readOnly = config.readOnly;
      v.focusable = config.focusable;
      v.focused = config.focused;
      v.inMutuallyExclusiveGroup = config.inMutuallyExclusiveGroup;
      v.obscured = config.obscured;
      v.multiline = config.multiline;
      v.scopesRoute = config.scopesRoute;
      v.namesRoute = config.namesRoute;
      v.hidden = config.hidden;
      v.image = config.image;
      v.liveRegion = config.liveRegion;
      v.maxValueLength = config.maxValueLength;
      v.currentValueLength = config.currentValueLength;
      v.label = config.label;
      v.value = config.value;
      v.increasedValue = config.increasedValue;
      v.decreasedValue = config.decreasedValue;
      v.hint = config.hint;
      v.onTapHint = config.onTapHint;
      v.onLongPressHint = config.onLongPressHint;
      v.textDirection = config.textDirection;
      v.onTap = config.onTap;
      v.onLongPress = config.onLongPress;
      v.onScrollLeft = config.onScrollLeft;
      v.onScrollRight = config.onScrollRight;
      v.onScrollDown = config.onScrollDown;
      v.onScrollUp = config.onScrollUp;
      v.onIncrease = config.onIncrease;
      v.onDecrease = config.onDecrease;
      v.onCopy = config.onCopy;
      v.onCut = config.onCut;
      v.onPaste = config.onPaste;
      v.onDismiss = config.onDismiss;
      v.onDidGainAccessibilityFocus = config.onDidGainAccessibilityFocus;
      v.onDidLoseAccessibilityFocus = config.onDidLoseAccessibilityFocus;
    }
    return v;
  }

}

//****** SwitchListTile ******
interface SwitchListTileConfig {
  key?:Key;
  value:boolean;
  onChanged:VoidValueChangedBoolean;
  activeColor?:Color;
  activeTrackColor?:Color;
  inactiveThumbColor?:Color;
  inactiveTrackColor?:Color;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  isThreeLine?:boolean;
  dense?:boolean;
  contentPadding?:EdgeInsets;
  secondary?:FlutterWidget;
  selected?:boolean;
  autofocus?:boolean;
  controlAffinity?:ListTileControlAffinity;
}
export class SwitchListTile extends FlutterWidget {
  key?:Key;
  value?:boolean;
  onChanged?:VoidValueChangedBoolean;
  activeColor?:Color;
  activeTrackColor?:Color;
  inactiveThumbColor?:Color;
  inactiveTrackColor?:Color;
  title?:FlutterWidget;
  subtitle?:FlutterWidget;
  isThreeLine?:boolean;
  dense?:boolean;
  contentPadding?:EdgeInsets;
  secondary?:FlutterWidget;
  selected?:boolean;
  autofocus?:boolean;
  controlAffinity?:ListTileControlAffinity;

  /**
   * @param config config: 
      {
        key?:Key, 
        value:boolean, 
        onChanged:VoidValueChangedBoolean, 
        activeColor?:Color, 
        activeTrackColor?:Color, 
        inactiveThumbColor?:Color, 
        inactiveTrackColor?:Color, 
        title?:FlutterWidget, 
        subtitle?:FlutterWidget, 
        isThreeLine?:boolean, 
        dense?:boolean, 
        contentPadding?:EdgeInsets, 
        secondary?:FlutterWidget, 
        selected?:boolean, 
        autofocus?:boolean, 
        controlAffinity?:ListTileControlAffinity, 
      }
   */
  static new(config: SwitchListTileConfig) {
    var v = new SwitchListTile();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.activeColor = config.activeColor;
      v.activeTrackColor = config.activeTrackColor;
      v.inactiveThumbColor = config.inactiveThumbColor;
      v.inactiveTrackColor = config.inactiveTrackColor;
      v.title = config.title;
      v.subtitle = config.subtitle;
      v.isThreeLine = config.isThreeLine;
      v.dense = config.dense;
      v.contentPadding = config.contentPadding;
      v.secondary = config.secondary;
      v.selected = config.selected;
      v.autofocus = config.autofocus;
      v.controlAffinity = config.controlAffinity;
    }
    return v;
  }

}

//****** TODO Slider ******
interface SliderConfig {
  key?:Key;
  value?:number;
  onChanged?:VoidValueChangedNumber;
  onChangeStart?:VoidValueChangedNumber;
  onChangeEnd?:VoidValueChangedNumber;
  min?:number;
  max?:number;
  divisions?:number;
  label?:string;
  activeColor?:Color;
  inactiveColor?:Color;
  semanticFormatterCallback?:VoidValueChangedNumber;
  autofocus?:boolean;  
}
export class Slider extends FlutterWidget {
  key?:Key;
  value?:number;
  onChanged?:VoidValueChangedNumber;
  onChangeStart?:VoidValueChangedNumber;
  onChangeEnd?:VoidValueChangedNumber;
  min?:number;
  max?:number;
  divisions?:number;
  label?:string;
  activeColor?:Color;
  inactiveColor?:Color;
  semanticFormatterCallback?:VoidValueChangedNumber;
  autofocus?:boolean;  

  /**
   * @param config config: 
    {
      key?:Key,
      value?:number, 
      onChanged?:VoidValueChangedNumber, 
      onChangeStart?:VoidValueChangedNumber, 
      onChangeEnd?:VoidValueChangedNumber, 
      min?:number, 
      max?:number, 
      divisions?:number, 
      label?:string, 
      activeColor?:Color,
      inactiveColor?:Color, 
      semanticFormatterCallback?:VoidValueChangedNumber, 
      autofocus?:boolean,
    }
   */
  static new(config: SliderConfig) {
    var v = new Slider();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.onChangeStart = config.onChangeStart;
      v.onChangeEnd = config.onChangeEnd;
      v.min = config.min;
      v.max = config.max;
      v.divisions = config.divisions;
      v.label = config.label;
      v.activeColor = config.activeColor;
      v.inactiveColor = config.inactiveColor;
      v.semanticFormatterCallback = config.semanticFormatterCallback;
      v.autofocus = config.autofocus;
    }
    return v;
  }

}

//****** SizedBox ******
interface SizedBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  width?:number;
  height?:number; 
  size?:Size;
}
export class SizedBox extends FlutterWidget {
  child?:FlutterWidget;
  width?:number;
  height?:number;
  key?:Key;
  size?:Size;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      width?:number, 
      height?:number, 
    }
   */
  static new(config: SizedBoxConfig) {
    var v = new SizedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.width = config.width;
      v.height = config.height;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
    }
   */
  static expand(config: SizedBoxConfig) {
    var v = new SizedBox();
    v.constructorName = "expand";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      size?:Size,
    }
   */
  static fromSize(config: SizedBoxConfig) {
    var v = new SizedBox();
    v.constructorName = "fromSize";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.size = config.size;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
    }
   */
  static shrink(config: SizedBoxConfig) {
    var v = new SizedBox();
    v.constructorName = "shrink";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}

//****** SizedOverflowBox ******
interface SizedOverflowBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  size:Size;
}
export class SizedOverflowBox extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  size?:Size;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      alignment?:Alignment, 
      size:Size, 
    }
   */
  static new(config: SizedOverflowBoxConfig) {
    var v = new SizedOverflowBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.size = config.size;
      v.alignment = config.alignment;
      v.child = config.child;
    }
    return v;
  }
}

//****** Stack ******
interface StackConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  alignment?:AlignmentDirectional;
  textDirection?:TextDirection;
  fit?:StackFit;
  overflow?:Overflow;  
  clipBehavior?:Clip;
}
export class Stack extends FlutterWidget {
  key?:Key;
  children?:Array<FlutterWidget>;
  alignment?:AlignmentDirectional;
  textDirection?:TextDirection;
  fit?:StackFit;
  overflow?:Overflow; 
  clipBehavior?:Clip;

  /**
   * @param config config: 
    {
      key?:Key, 
      children?:Array<FlutterWidget>, 
      alignment?:AlignmentDirectional, 
      textDirection?:TextDirection, 
      fit?:StackFit, 
      overflow?:Overflow, 
      clipBehavior?:Clip, 
    }
   */
  static new(config: StackConfig) {
    var v = new Stack();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.alignment = config.alignment;
      v.textDirection = config.textDirection;
      v.fit = config.fit;
      v.overflow = config.overflow;
      v.children = config.children;
    }
    return v;
  }
}

//****** TODO SliverAppBar ******
interface SliverAppBarConfig {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  title?:FlutterWidget;
  actions?:Array<FlutterWidget>;
  flexibleSpace?:FlutterWidget;
  bottom?:FlutterWidget;
  elevation?:number;
  shadowColor?:Color;
  forceElevated?:boolean;
  backgroundColor?:Color;  
  brightness?:Brightness;
  iconTheme?:IconThemeData;
  actionsIconTheme?:IconThemeData;
  primary?:boolean;
  centerTitle?:boolean;  
  excludeHeaderSemantics?:boolean;
  titleSpacing?:number;
  collapsedHeight?:number;
  expandedHeight?:number;
  floating?:boolean;
  pinned?:boolean;
  snap?:boolean;
  stretch?:boolean;
  stretchTriggerOffset?:number;
  onStretchTrigger?:VoidCallback;
  shape?:any;
  toolbarHeight?:number;
}
export class SliverAppBar extends FlutterWidget {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  title?:FlutterWidget;
  actions?:Array<FlutterWidget>;
  flexibleSpace?:FlutterWidget;
  bottom?:FlutterWidget;
  elevation?:number;
  shadowColor?:Color;
  forceElevated?:boolean;
  backgroundColor?:Color;
  brightness?:Brightness;
  iconTheme?:IconThemeData;
  actionsIconTheme?:IconThemeData;
  primary?:boolean;
  centerTitle?:boolean;  
  excludeHeaderSemantics?:boolean;
  titleSpacing?:number;
  collapsedHeight?:number;
  expandedHeight?:number;
  floating?:boolean;
  pinned?:boolean;
  snap?:boolean;
  stretch?:boolean;
  stretchTriggerOffset?:number;
  onStretchTrigger?:VoidCallback;
  shape?:any;
  toolbarHeight?:number;

  /**
   * @param config config: 
    {
      key?:Key, 
      leading?:FlutterWidget, 
      automaticallyImplyLeading?:boolean, 
      title?:FlutterWidget, 
      actions?:Array<FlutterWidget>, 
      flexibleSpace?:FlutterWidget, 
      bottom?:FlutterWidget, 
      elevation?:number, 
      shadowColor?:Color,
      forceElevated?:boolean, 
      backgroundColor?:Color, 
      brightness?:Brightness, 
      iconTheme?:IconThemeData, 
      actionsIconTheme?:IconThemeData, 
      primary?:boolean, 
      centerTitle?:boolean, 
      excludeHeaderSemantics?:boolean, 
      titleSpacing?:number, 
      collapsedHeight?:number, 
      expandedHeight?:number, 
      floating?:boolean, 
      pinned?:boolean, 
      snap?:boolean, 
      stretch?:boolean, 
      stretchTriggerOffset?:number 
      onStretchTrigger?:VoidCallback, 
      shape?:any, 
      toolbarHeight?:number,
    }
   */
  static new(config: SliverAppBarConfig) {
    var v = new SliverAppBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.leading = config.leading;
      v.automaticallyImplyLeading = config.automaticallyImplyLeading;
      v.title = config.title;
      v.actions = config.actions;
      v.flexibleSpace = config.flexibleSpace;
      v.bottom = config.bottom;
      v.elevation = config.elevation;
      v.shadowColor = config.shadowColor;
      v.forceElevated = config.forceElevated;
      v.backgroundColor = config.backgroundColor;
      v.brightness = config.brightness;
      v.iconTheme = config.iconTheme;
      v.actionsIconTheme = config.actionsIconTheme;
      v.primary = config.primary;
      v.centerTitle = config.centerTitle;
      v.titleSpacing = config.titleSpacing;
      v.excludeHeaderSemantics = config.excludeHeaderSemantics;
      v.collapsedHeight = config.collapsedHeight;
      v.expandedHeight = config.expandedHeight;
      v.floating = config.floating;
      v.pinned = config.pinned;
      v.snap = config.snap;
      v.stretch = config.stretch;
      v.stretchTriggerOffset = config.stretchTriggerOffset;
      v.onStretchTrigger = config.onStretchTrigger;
      v.shape = config.shape;
      v.toolbarHeight = config.toolbarHeight;
    }
    return v;
  }
}

//****** SliverPadding ******
interface SliverPaddingConfig {
  key?:Key;
  sliver?:FlutterWidget;
  padding:EdgeInsets;
}
export class SliverPadding extends FlutterWidget {
  sliver?:FlutterWidget;
  padding?:EdgeInsets;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      sliver?:FlutterWidget, 
      padding:EdgeInsets, 
    }
   */
  static new(config: SliverPaddingConfig) {
    var v = new SliverPadding();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.padding = config.padding;
      v.sliver = config.sliver;
    }
    return v;
  }
}

//****** TODO SliverGrid ******
interface SliverGridConfig {
  delegate?:any;
  gridDelegate?:any;
  key?:Key;
}
export class SliverGrid extends FlutterWidget {
  delegate?:any;
  gridDelegate?:any;
  key?:Key;

  /**
   * @param config config: 
    {
      delegate?:any, 
      gridDelegate?:any, 
      key?:Key,
    }
   */
  static new(config: SliverGridConfig) {
    var v = new SliverGrid();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
      v.gridDelegate = config.gridDelegate;
    }
    return v;
  }
}

//****** TODO SliverGridDelegateWithMaxCrossAxisExtent ******
interface SliverGridDelegateWithMaxCrossAxisExtentConfig {
  maxCrossAxisExtent?:number;
  mainAxisSpacing?:number;
  crossAxisSpacing?:number;
  childAspectRatio?:number;
}
export class SliverGridDelegateWithMaxCrossAxisExtent extends FlutterWidget {
  maxCrossAxisExtent?:number;
  mainAxisSpacing?:number;
  crossAxisSpacing?:number;
  childAspectRatio?:number;

  /**
   * @param config config: 
    {
      maxCrossAxisExtent?:number, 
      mainAxisSpacing?:number, 
      crossAxisSpacing?:number, 
      childAspectRatio?:number, 
    }
   */
  static new(config: SliverGridDelegateWithMaxCrossAxisExtentConfig) {
    var v = new SliverGridDelegateWithMaxCrossAxisExtent();
    if(config!=null && config!=undefined){
      v.maxCrossAxisExtent = config.maxCrossAxisExtent;
      v.mainAxisSpacing = config.mainAxisSpacing;
      v.crossAxisSpacing = config.crossAxisSpacing;
      v.childAspectRatio = config.childAspectRatio;
    }
    return v;
  }
}

//****** TODO SliverChildListDelegate ******
interface SliverChildListDelegateConfig {
  children?:Array<FlutterWidget>;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  semanticIndexOffset?:number;
}
export class SliverChildListDelegate extends DartClass {
  children?:Array<FlutterWidget>;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  semanticIndexOffset?:number;

  /**
   * @param config config: 
    {
      children?:Array<FlutterWidget>, 
      addAutomaticKeepAlives?:boolean, 
      addRepaintBoundaries?:boolean, 
      addSemanticIndexes?:boolean, 
      semanticIndexOffset?:number, 
    }
   */
  static new(config: SliverChildListDelegateConfig) {
    var v = new SliverChildListDelegate();
    if(config!=null && config!=undefined){
      v.children = config.children;
      v.addAutomaticKeepAlives = config.addAutomaticKeepAlives;
      v.addRepaintBoundaries = config.addRepaintBoundaries;
      v.addSemanticIndexes = config.addSemanticIndexes;
      v.semanticIndexOffset = config.semanticIndexOffset;
    }
    return v;
  }
}

//****** TODO SliverChildBuilderDelegate ******
interface SliverChildBuilderDelegateConfig {
  builder:any;
  childCount?:number;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  semanticIndexOffset?:number;
  children?:Array<FlutterWidget>;
}
export class SliverChildBuilderDelegate extends FlutterWidget {
  builder:any;
  childCount?:number;
  addAutomaticKeepAlives?:boolean;
  addRepaintBoundaries?:boolean;
  addSemanticIndexes?:boolean;
  semanticIndexOffset?:number;
  children?:Array<FlutterWidget>;
 
  preBuild(jsWidgetHelper?:any, buildContext?:any) {
    if (this.builder) {
      if(this.childCount!=null && this.childCount!=undefined){
      for (let i = 0; i < this.childCount; ++i) {
        let w = this.builder(buildContext, i);
        if(this.children!=null && this.children!=undefined){
          this.children.push(w);
        }
      }
    }
      delete this.builder;
    }

    super.preBuild(jsWidgetHelper, buildContext);
  }

  /**
   * @param config config: 
    {
      builder:any, 
      childCount?:number, 
      addAutomaticKeepAlives?:boolean, 
      addRepaintBoundaries?:boolean, 
      addSemanticIndexes?:boolean, 
      semanticIndexOffset?:number, 
      children?:Array<FlutterWidget>, 
    }
   */
  static new(config: SliverChildBuilderDelegateConfig) {
    var v = new SliverChildBuilderDelegate();
    if(config!=null && config!=undefined){
      v.builder = config.builder;
      v.childCount = config.childCount;
      v.addAutomaticKeepAlives = config.addAutomaticKeepAlives;
      v.addRepaintBoundaries = config.addRepaintBoundaries;
      v.addSemanticIndexes = config.addSemanticIndexes;
      v.semanticIndexOffset = config.semanticIndexOffset;
    }
    // 本地创建的，供flutter使用
    v.children = [];
    return v;
  }
}

//****** TODO SliverList ******
interface SliverListConfig {
  delegate?:any;
  key?:Key;
}
export class SliverList extends FlutterWidget {
  delegate?:any;
  key?:Key;

  /**
   * @param config config: 
    {
      delegate?:any,
      key?:Key
    }
   */
  static new(config: SliverListConfig) {
    var v = new SliverList();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
    }
    return v;
  }
}

//****** TODO SliverOverlapInjector ******
interface SliverOverlapInjectorConfig {
  key?:Key;
  child?:FlutterWidget;
  handle?:any;
}
export class SliverOverlapInjector extends FlutterWidget {
  child?:FlutterWidget;
  handle?:any;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      handle?:any, 
    }
   */
  static new(config: SliverOverlapInjectorConfig) {
    var v = new SliverOverlapInjector();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.handle = config.handle;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO SliverFixedExtentList ******
interface SliverFixedExtentListConfig {
  key?:Key;
  delegate?:any;
  itemExtent?:number;
}
export class SliverFixedExtentList extends FlutterWidget {
  delegate?:any;
  itemExtent?:number;
  key?:Key;
 
  /**
   * @param config config: 
    {
      key?:Key, 
      delegate?:any, 
      itemExtent?:number, 
    }
   */
  static new(config: SliverFixedExtentListConfig) {
    var v = new SliverFixedExtentList();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.delegate = config.delegate;
      v.itemExtent = config.itemExtent;
    }
    return v;
  }
}


//****** TODO SliverOverlapAbsorber ******
interface SliverOverlapAbsorberConfig {
  key?:Key;
  child?:FlutterWidget;
  handle?:any;
}
export class SliverOverlapAbsorber extends FlutterWidget {
  child?:FlutterWidget;
  handle?:any;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      handle?:any, 
    }
   */
  static new(config: SliverOverlapAbsorberConfig) {
    var v = new SliverOverlapAbsorber();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.handle = config.handle;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO SingleChildScrollView ******
interface SingleChildScrollViewConfig {
  key?:Key;
  child?:FlutterWidget;
  scrollDirection?:Axis;
  reverse?:boolean;
  padding?:EdgeInsets;
  primary?:boolean;
  physics?:ScrollPhysics;
  controller?:ScrollController;
  dragStartBehavior?:DragStartBehavior;
  clipBehavior?:Clip;
}
export class SingleChildScrollView extends FlutterWidget {
  
  child?:FlutterWidget;
  scrollDirection?:Axis;
  reverse?:boolean;
  padding?:EdgeInsets;
  primary?:boolean;
  physics?:ScrollPhysics;
  controller?:ScrollController;
  dragStartBehavior?:DragStartBehavior;
  clipBehavior?:Clip;
  key?:Key;


  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      scrollDirection?:Axis, 
      reverse?:boolean, 
      padding?:EdgeInsets, 
      primary?:boolean, 
      physics?:ScrollPhysics, 
      controller?:ScrollController, 
      dragStartBehavior?:DragStartBehavior, 
      clipBehavior?:Clip, 
    }
   */
  static new(config: SingleChildScrollViewConfig) {
      var v = new SingleChildScrollView();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.scrollDirection = config.scrollDirection;
        v.reverse = config.reverse;
        v.padding = config.padding;
        v.primary = config.primary;
        v.physics = config.physics;
        v.controller = config.controller;
        v.child = config.child;
        v.dragStartBehavior = config.dragStartBehavior;
        v.clipBehavior = config.clipBehavior;
      }
      return v;
  }
}

//****** SliverToBoxAdapter ******
interface SliverToBoxAdapterConfig {
  child?:FlutterWidget;
  key?:Key;
}
export class SliverToBoxAdapter extends FlutterWidget {
  child?:FlutterWidget;
  key?:Key;

  /**
   * @param config config: 
    {
      child?:FlutterWidget,
      key?:Key
    }
   */
  static new(config: SliverToBoxAdapterConfig) {
    var v = new SliverToBoxAdapter();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO Scaffold ******
interface ScaffoldConfig {
  key?:Key;
  appBar?:FlutterWidget;
  body?:FlutterWidget;
  floatingActionButton?:FlutterWidget;
  floatingActionButtonLocation?:FloatingActionButtonLocation;
  persistentFooterButtons?:Array<FlutterWidget>;
  drawer?:FlutterWidget;
  endDrawer?:FlutterWidget;
  bottomNavigationBar?:FlutterWidget;
  bottomSheet?:FlutterWidget;
  backgroundColor?:Color;
  resizeToAvoidBottomPadding?:boolean;
  primary?:boolean;
  
}
export class Scaffold extends FlutterWidget {
  appBar?:FlutterWidget;
  body?:FlutterWidget;
  floatingActionButton?:FlutterWidget;
  floatingActionButtonLocation?:FloatingActionButtonLocation;
  persistentFooterButtons?:Array<FlutterWidget>;
  drawer?:FlutterWidget;
  endDrawer?:FlutterWidget;
  bottomNavigationBar?:FlutterWidget;
  bottomSheet?:FlutterWidget;
  backgroundColor?:Color;
  resizeToAvoidBottomPadding?:boolean;
  primary?:boolean;
  key?:Key;

  //FIXME,github mergegithub merge
  static of(context:any) {
    return {
      showSnackBar: function (snackBar:any) {
        //准备调用Native方法执行真正的 showSnackBar动作
        //1.把这里的context和snackBar数据传递到native层 ✔️
        //2.通过context找到Native里的 Scaffold.of(context) ？
        //3.解析snackBar为真snackBar对象 ✔️
        //4.执行调用
        //console.log("showSnackBar in js call native-->")
        /*let argument = new FlutterCallArgs({
          widgetID: context.widgetID,
          className: 'Scaffold',
          funcName: 'of',
          args: {
            snackBar: snackBar,
          },
        });*/
        
        //invokeCommonFlutterFunction(argument);
      },
      openDrawer: function () {
        //console.log("showSnackBar in js call native-->")
      },
    };
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      appBar?:FlutterWidget, 
      body?:FlutterWidget, 
      floatingActionButton?:FlutterWidget, 
      floatingActionButtonLocation?:FloatingActionButtonLocation, 
      persistentFooterButtons?:Array<FlutterWidget>, 
      drawer?:FlutterWidget, 
      endDrawer?:FlutterWidget, 
      bottomNavigationBar?:FlutterWidget, 
      bottomSheet?:FlutterWidget, 
      backgroundColor?:Color, 
      resizeToAvoidBottomPadding?:boolean, 
      primary?:boolean, 
    }
   */
  static new(config: ScaffoldConfig){
    var v = new Scaffold();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.appBar = config.appBar;
      v.body = config.body;
      v.floatingActionButton = config.floatingActionButton;
      v.floatingActionButtonLocation = config.floatingActionButtonLocation;
      v.persistentFooterButtons = config.persistentFooterButtons;
      v.drawer = config.drawer;
      v.endDrawer = config.endDrawer;
      v.bottomNavigationBar = config.bottomNavigationBar;
      v.bottomSheet = config.bottomSheet;
      v.backgroundColor = config.backgroundColor;
      v.resizeToAvoidBottomPadding = config.resizeToAvoidBottomPadding;
      v.primary = config.primary;
    }
    return v;
  }
}

//****** TODO Scaffold ******
export class ScaffoldState extends DartClass {
  static new() {
    return new ScaffoldState();
  }
}

//****** TODO SafeArea ******
interface SafeAreaConfig {
  key?:Key;
  child?:FlutterWidget;
  left?:boolean;
  top?:boolean;
  right?:boolean;
  bottom?:boolean;
  minimum?:EdgeInsets;
  maintainBottomViewPadding?:boolean;  
}
export class SafeArea extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  left?:boolean;
  top?:boolean;
  right?:boolean;
  bottom?:boolean;
  minimum?:EdgeInsets;
  maintainBottomViewPadding?:boolean;  

  /**
   * @param config config: 
      {
        key?:Key,
        child?:FlutterWidget,
        left?:boolean,
        top?:boolean,
        right?:boolean,
        bottom?:boolean,
        minimum?:EdgeInsets,
        maintainBottomViewPadding?:boolean, 
      }
   */
  static new(config: SafeAreaConfig) {
    var v = new SafeArea();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.minimum = config.minimum;
      v.maintainBottomViewPadding = config.maintainBottomViewPadding;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO SliverSafeArea ******
interface SliverSafeAreaConfig {
  key?:Key;
  sliver?:FlutterWidget;
  left?:boolean;
  top?:boolean;
  right?:boolean;
  bottom?:boolean;
  minimum?:EdgeInsets;
}
export class SliverSafeArea extends FlutterWidget {
  key?:Key;
  sliver?:FlutterWidget;
  left?:boolean;
  top?:boolean;
  right?:boolean;
  bottom?:boolean;
  minimum?:EdgeInsets;

  /**
   * @param config config: 
    {
      key?:Key,
      child?:FlutterWidget,
      left?:boolean,
      top?:boolean,
      right?:boolean,
      bottom?:boolean,
      minimum?:EdgeInsets,
    }
   */
  static new(config: SliverSafeAreaConfig) {
    var v = new SliverSafeArea();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.left = config.left;
      v.top = config.top;
      v.right = config.right;
      v.bottom = config.bottom;
      v.minimum = config.minimum;
      v.sliver = config.sliver;
    }
    return v;
  }
}

//****** Scrollbar ******
interface ScrollbarConfig {
  key?:Key;
  child:FlutterWidget;
  controller?:ScrollController;
  isAlwaysShown?:boolean;
}
export class Scrollbar extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  controller?:ScrollController;
  isAlwaysShown?:boolean;

  /**
   * @param config config: 
    {
      key?:Key, 
      child:FlutterWidget, 
      controller?:ScrollController, 
      isAlwaysShown?:boolean,   
    }
   */
  static new (config: ScrollbarConfig) {
    var v = new Scrollbar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.controller = config.controller;
      v.isAlwaysShown = config.isAlwaysShown;
    }
    return v;
  }
}

//****** SnackBar ******
interface SnackBarConfig {
  key?:FlutterWidget;
  content:FlutterWidget;
  backgroundColor?:Color;
  elevation?:number;
  shape?:any;
  behavior?:any;
  action?:any;
  duration?:Duration;
  animation?:any;
  onVisible?:VoidCallback;
}
export class SnackBar extends FlutterWidget {
  content?:FlutterWidget;
  backgroundColor?:Color;
  elevation?:number;
  shape?:any;
  behavior?:any;
  action?:any;
  duration?:Duration;
  animation?:any;
  onVisible?:VoidCallback;
  key?:FlutterWidget;

  /**
   * @param config config: 
    {
      key?:FlutterWidget, 
      content:FlutterWidget, 
      backgroundColor?:Color, 
      elevation?:number, 
      shape?:any, 
      behavior?:any, 
      action?:any, 
      duration?:Duration, 
      animation?:any, 
      onVisible?:VoidCallback, 
    }
   */
  static new(config: SnackBarConfig) {
    var v = new SnackBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.content = config.content;
      v.backgroundColor = config.backgroundColor;
      v.elevation = config.elevation;
      v.shape = config.shape;
      v.behavior = config.behavior;
      v.action = config.action;
      v.duration = config.duration;
      v.animation = config.animation;
      v.onVisible = config.onVisible;
    }
    return v;
  }
}

//****** TODO SnackBarAction ******
interface SnackBarActionConfig {
  key?:FlutterWidget;
  lable?:string;
  onPressed?:VoidCallback;
  disabledTextColor?:Color;
  textColor?:Color;
}
export class SnackBarAction extends FlutterWidget {
  key?:FlutterWidget;
  lable?:string;
  onPressed?:VoidCallback;
  disabledTextColor?:Color;
  textColor?:Color;

  /**
   * @param config config: 
    {
      key?:FlutterWidget, 
      lable?:string, 
      onPressed?:VoidCallback, 
      disabledTextColor?:Color, 
      textColor?:Color, 
    }
   */
  static new(config: SnackBarActionConfig) {
    var v = new SnackBarAction();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.lable = config.lable;
      v.textColor = config.textColor;
      v.disabledTextColor = config.disabledTextColor;
      v.onPressed = config.onPressed;
    }
    return v;
  }
}

//****** SliverVisibility ******
interface SliverVisibilityConfig {
  key?:Key;
  sliver:FlutterWidget;
  replacementSliver?:FlutterWidget;
  visible?:boolean;
  maintainState?:boolean;
  maintainAnimation?:boolean;
  maintainSize?:boolean;
  maintainSemantics?:boolean;
  maintainInteractivity?:boolean;
}
export class SliverVisibility extends FlutterWidget {
  key?:Key;
  sliver?:FlutterWidget;
  replacementSliver?:FlutterWidget;
  visible?:boolean;
  maintainState?:boolean;
  maintainAnimation?:boolean;
  maintainSize?:boolean;
  maintainSemantics?:boolean;
  maintainInteractivity?:boolean;

  /**
   * @param config config: 
    {
      key?:Key, 
      sliver:FlutterWidget, 
      replacement?:FlutterWidget, 
      visible?:boolean, 
      maintainState?:boolean, 
      maintainAnimation?:boolean, 
      maintainSize?:boolean, 
      maintainSemantics?:boolean, 
      maintainInteractivity?:boolean, 
    }
  */
  static new(config: SliverVisibilityConfig) {
    var v = new SliverVisibility();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.sliver = config.sliver;
      v.replacementSliver = config.replacementSliver;
      v.visible = config.visible;
      v.maintainAnimation = config.maintainAnimation;
      v.maintainState = config.maintainState;
      v.maintainSize = config.maintainSize;
      v.maintainSemantics = config.maintainSemantics;
      v.maintainInteractivity = config.maintainInteractivity;
    }
    return v;
  }
}


//#endregion

//#region ------- T -------
//****** TODO TableRow ******
interface TableRowConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  decoration?:BoxDecoration;
}
export class TableRow extends FlutterWidget {
  children?:Array<FlutterWidget>;
  decoration?:BoxDecoration;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      children?:Array<FlutterWidget>, 
      decoration?:BoxDecoration, 
    }
   */
   static new(config: TableRowConfig) {
    var v = new TableRow();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.decoration = config.decoration;
      v.children = config.children;
    }
    return v;
  }
}

//****** TODO TableCell ******
interface TableCellConfig {
  key?:Key;
  child?:FlutterWidget;
  verticalAlignment?:TableCellVerticalAlignment;
}
export class TableCell extends FlutterWidget {
  child?:FlutterWidget;
  verticalAlignment?:TableCellVerticalAlignment;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      verticalAlignment?:TableCellVerticalAlignment, 
    }
   */
  static new(config: TableCellConfig) {
    var v = new TableCell();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.verticalAlignment = config.verticalAlignment;
      v.child = config.child;
    }
    return v;
  }
}

//****** Transform ******
interface TransformNewConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  origin?:Offset;
  transform:Matrix4;
  transformHitTests?:boolean;
}
interface TransformRotateConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  origin?:Offset;
  transformHitTests?:boolean;
  angle:number;
}
interface TransformTranslateConfig {
  key?:Key;
  child?:FlutterWidget;
  offset:Offset;
  transformHitTests?:boolean;
}
interface TransformScaleConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  origin?:Offset;
  transformHitTests?:boolean;
  scale:number;
}
export class Transform extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:Alignment;
  origin?:Offset;
  transform?:Matrix4;
  transformHitTests?:boolean;
  key?:Key;
  angle?:number;
  offset?:Offset;
  scale?:number;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      alignment?:Alignment, 
      origin?:Offset, 
      transform:Matrix4, 
      transformHitTests?:boolean, 
    }
   */
  static new(config: TransformNewConfig) {
    var v = new Transform();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.transform = config.transform;
      v.origin = config.origin;
      v.alignment = config.alignment;
      v.transformHitTests = config.transformHitTests;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      angle:number, 
      alignment?:Alignment, 
      origin?:Offset, 
      transformHitTests?:boolean, 
    }
   */
  static rotate(config: TransformRotateConfig) {
    var v = new Transform();
    v.constructorName = "rotate";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.angle = config.angle;
      v.origin = config.origin;
      v.alignment = config.alignment;
      v.transformHitTests = config.transformHitTests;
      v.child = config.child;
    }
    return v;
  }


  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      offset:Offset, 
      transformHitTests?:boolean, 
    }
   */
  static translate(config: TransformTranslateConfig) {
    var v = new Transform();
    v.constructorName = "translate";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.offset = config.offset;
      v.transformHitTests = config.transformHitTests;
      v.child = config.child;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      scale:number, 
      alignment?:Alignment, 
      origin?:Offset, 
      transformHitTests?:boolean, 
    }
   */
  static scale(config: TransformScaleConfig) {
    var v = new Transform();
    v.constructorName = "scale";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.scale = config.scale;
      v.origin = config.origin;
      v.alignment = config.alignment;
      v.transformHitTests = config.transformHitTests;
      v.child = config.child;
    }
    return v;
  }
}

//****** Tooltip ******
interface TooltipConfig {
  key?:Key;
  message:string;
  height?:number;
  padding?:EdgeInsets;
  margin?:EdgeInsets;
  verticalOffset?:number;
  preferBelow?:boolean;
  excludeFromSemantics?:boolean;
  decoration?:BoxDecoration;
  textStyle?:TextStyle;
  waitDuration?:Duration;
  showDuration?:Duration;
  child?:FlutterWidget;
}
export class Tooltip extends FlutterWidget {
  key?:Key;
  message?:string;
  height?:number;
  padding?:EdgeInsets;
  margin?:EdgeInsets;
  verticalOffset?:number;
  preferBelow?:boolean;
  excludeFromSemantics?:boolean;
  decoration?:BoxDecoration;
  textStyle?:TextStyle;
  waitDuration?:Duration;
  showDuration?:Duration;
  child?:FlutterWidget;

  /**
   * @param config config: 
    {
      key?:Key, 
      message:string, 
      height?:number, 
      padding?:EdgeInsets, 
      margin?:EdgeInsets, 
      verticalOffset?:number, 
      preferBelow?:boolean, 
      excludeFromSemantics?:boolean, 
      decoration?:BoxDecoration, 
      textStyle?:TextStyle, 
      waitDuration?:Duration, 
      showDuration?:Duration, 
      child?:FlutterWidget
    }
   */
  static new(config: TooltipConfig) {
    var v = new Tooltip();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.message = config.message;
      v.height = config.height;
      v.padding = config.padding;
      v.margin = config.margin;
      v.verticalOffset = config.verticalOffset;
      v.preferBelow = config.preferBelow;
      v.excludeFromSemantics = config.excludeFromSemantics;
      v.decoration = config.decoration;
      v.textStyle = config.textStyle;
      v.waitDuration = config.waitDuration;
      v.showDuration = config.showDuration;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO Table ******
interface TableConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  defaultColumnWidth?:TableColumnWidth;
  defaultVerticalAlignment?:TableCellVerticalAlignment;
  textDirection?:TextDecoration;
  border?:TableBorder;
  textBaseline?:TextBaseline;
  columnWidths?:Map<string,TableColumnWidth>;
  
}
export class Table extends  FlutterWidget {
  children?:Array<FlutterWidget>;
  defaultColumnWidth?:TableColumnWidth;
  defaultVerticalAlignment?:TableCellVerticalAlignment;
  textDirection?:TextDecoration;
  border?:TableBorder;
  textBaseline?:TextBaseline;
  columnWidths?:Map<string,TableColumnWidth>;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      children?:Array<FlutterWidget>, 
      defaultColumnWidth?:TableColumnWidth, 
      defaultVerticalAlignment?:TableCellVerticalAlignment, 
      textDirection?:TextDecoration, 
      border?:TableBorder, 
      textBaseline?:TextBaseline, 
      columnWidths?:Map<string,TableColumnWidth>,       
    }
   */
  static new(config: TableConfig) {
    var v = new Table();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.children = config.children;
      v.columnWidths= config.columnWidths;
      v.defaultColumnWidth = config.defaultColumnWidth;
      v.textDirection = config.textDirection;
      v.border = config.border;
      v.defaultVerticalAlignment = config.defaultVerticalAlignment;
      v.textBaseline = config.textBaseline;
    }
    return v;
  }
}

//****** TODO TabBar ******
interface TabBarConfig {
  key?:Key;
  tabs?:Array<FlutterWidget>;
  onTap?:VoidValueChangedNumber;
  controller?:TabController;
  isScrollable?:boolean;
  indicatorColor?:Color;
  indicatorWeight?:number;
  indicatorPadding?:EdgeInsets;
  indicator?:BoxDecoration;
  indicatorSize?:TabBarIndicatorSize;
  labelColor?:Color;
  labelStyle?:TextStyle;
  labelPadding?:EdgeInsets;
  unselectedLabelColor?:Color;
  unselectedLabelStyle?:TextStyle;
  dragStartBehavior?:DragStartBehavior;
  physics?:ScrollPhysics;
}
export class TabBar extends  FlutterWidget {
  key?:Key;
  tabs?:Array<FlutterWidget>;
  onTap?:VoidValueChangedNumber;
  controller?:TabController;
  isScrollable?:boolean;
  indicatorColor?:Color;
  indicatorWeight?:number;
  indicatorPadding?:EdgeInsets;
  indicator?:BoxDecoration;
  indicatorSize?:TabBarIndicatorSize;
  labelColor?:Color;
  labelStyle?:TextStyle;
  labelPadding?:EdgeInsets;
  unselectedLabelColor?:Color;
  unselectedLabelStyle?:TextStyle;
  dragStartBehavior?:DragStartBehavior;
  physics?:ScrollPhysics;

   /**
   * @param config config: 
    {
      key?:Key, 
      tabs?:Array<FlutterWidget>,
      onTap?:VoidValueChangedNumber, 
      controller?:TabController, 
      isScrollable?:boolean, 
      indicatorColor?:Color, 
      indicatorWeight?:number, 
      indicatorPadding?:EdgeInsets, 
      indicator?:BoxDecoration, 
      indicatorSize?:TabBarIndicatorSize, 
      labelColor?:Color, 
      labelStyle?:TextStyle, 
      labelPadding?:EdgeInsets, 
      unselectedLabelColor?:Color, 
      unselectedLabelStyle?:TextStyle, 
      dragStartBehavior?:DragStartBehavior,
      physics?:ScrollPhysics,
    }
   */
  static new(config: TabBarConfig) {
    var v = new TabBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.tabs = config.tabs;
      v.controller = config.controller;
      v.isScrollable = config.isScrollable;
      v.indicatorColor = config.indicatorColor;
      v.indicatorWeight = config.indicatorWeight;
      v.indicatorPadding = config.indicatorPadding;
      v.indicator = config.indicator;
      v.indicatorSize = config.indicatorSize;
      v.labelColor = config.labelColor;
      v.labelStyle = config.labelStyle;
      v.labelPadding = config.labelPadding;
      v.unselectedLabelColor = config.unselectedLabelColor;
      v.unselectedLabelStyle = config.unselectedLabelStyle;
      v.dragStartBehavior = config.dragStartBehavior;
      v.onTap = config.onTap;
      v.physics = config.physics;
    }
    return v;
  }
}

//****** Tab ******
interface TabConfig {
  key?:Key;
  child?:FlutterWidget;
  text?:string;
  icon?:FlutterWidget;
  iconMargin?:EdgeInsets;
}
export class Tab extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  text?:string;
  icon?:FlutterWidget;
  iconMargin?:EdgeInsets;

  /**
   * @param config config: 
    {
      key?:Key, 
      child?:FlutterWidget, 
      text?:string, 
      icon?:FlutterWidget, 
      iconMargin?:EdgeInsets,
    }
   */
  static new(config: TabConfig) {
    var v = new Tab();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.text = config.text;
      v.icon = config.icon;
      v.child = config.child;
    }
    return v;
  }
}

//****** TODO TabBarView ******
interface TabBarViewConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  controller?:TabController;
  physics?:ScrollPhysics;
  dragStartBehavior?:DragStartBehavior;
}
export class TabBarView extends FlutterWidget {
  children?:Array<FlutterWidget>;
  controller?:TabController;
  physics?:ScrollPhysics;
  dragStartBehavior?:DragStartBehavior;
  key?:Key;

  /**
   * @param config config:
    {
      key?:Key, 
      children?:Array<FlutterWidget>, 
      controller?:TabController, 
      physics?:ScrollPhysics, 
      dragStartBehavior?:DragStartBehavior,      
    }
   */
  static new(config: TabBarViewConfig) {
    var v = new TabBarView();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.children = config.children;
      v.controller = config.controller;
      v.physics = config.physics;
      v.dragStartBehavior = config.dragStartBehavior;
    }
    return v;
  }
}

//****** TODO TabPageSelectorIndicator ******
interface TabPageSelectorIndicatorConfig {
  key?:Key;
  backgroundColor?:Color;
  borderColor?:Color;
  size?:number;
}
export class TabPageSelectorIndicator extends FlutterWidget {
  key?:Key;
  backgroundColor?:Color;
  borderColor?:Color;
  size?:number;


  /**
   * @param config config: 
    {
      key?:Key, 
      backgroundColor?:Color, 
      borderColor?:Color, 
      size?:number,
    }
   */
  static new(config: TabPageSelectorIndicatorConfig) {
    var v = new TabPageSelectorIndicator();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.backgroundColor = config.backgroundColor;
      v.borderColor = config.borderColor;
      v.size = config.size;
    }
    return v;
  }
}

//****** TODO TabPageSelector ******
interface TabPageSelectorConfig {
  key?:Key;
  color?:Color;
  selectedColor?:Color;
  indicatorSize?:number;
  controller?:TabController;
}
export class TabPageSelector extends FlutterWidget {
  key?:Key;
  color?:Color;
  selectedColor?:Color;
  indicatorSize?:number;
  controller?:TabController;
  /**
   * @param config config: 
    {
      key?:Key,
      color?:Color,
      selectedColor?:Color,
      indicatorSize?:number,
      controller?:TabController,
    }
   */
  static new(config: TabPageSelectorConfig) {
    var v = new TabPageSelector();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.selectedColor = config.selectedColor;
      v.indicatorSize = config.indicatorSize;
      v.controller = config.controller;
    }
    return v;
  }
}

//****** TODO Title ******
interface TitleConfig {
  key?:Key;
  child?:FlutterWidget;
  title?:string;
  color?:Color;
}
export class Title extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  title?:string;
  color?:Color;


  /**
   * @param config config: 
    {
      key?:Key,
      child?:FlutterWidget,
      title?:string,
      color?:Color
    }
   */
  static new(config: TitleConfig) {
    var v = new Title();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.title = config.title;
      v.color = config.color;
    }
    return v;
  }
}

//****** TODO Text ******
interface TextConfig {
  key?:Key;
  style?:TextStyle;
  textAlign?:TextAlign;
  textDirection?:TextDirection;
  softWrap?:boolean;
  overflow?:TextOverflow;
  textScaleFactor?:number;
  maxLines?:number;
  semanticsLabel?:string
  textWidthBasis?:TextWidthBasis;
}
export class Text extends FlutterWidget {
  data?:string;

  textSpan?:TextSpan;
  key?:Key;
  style?:TextStyle;
  textAlign?:TextAlign;
  textDirection?:TextDirection;
  softWrap?:boolean;
  overflow?:TextOverflow;
  textScaleFactor?:number;
  maxLines?:number;
  semanticsLabel?:string;
  textWidthBasis?:TextWidthBasis;

  /**
   * @param config config: 
    {
      key?:Key,
      style?:TextStyle,
      textAlign?:TextAlign,
      textDirection?:TextDirection,
      softWrap?:boolean,
      overflow?:TextOverflow,
      textScaleFactor?:number,
      maxLines?:number,
      semanticsLabel?:string,
      textWidthBasis?:TextWidthBasis,
    }
   */
  static new(data:string, config?: TextConfig) {
    var v = new Text();
    v.data = data;
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.style = config.style;
      v.textAlign = config.textAlign;
      v.textDirection = config.textDirection;
      v.softWrap = config.softWrap;
      v.overflow = config.overflow;
      v.textScaleFactor = config.textScaleFactor;
      v.maxLines = config.maxLines;
      v.semanticsLabel = config.semanticsLabel;
      v.textWidthBasis = config.textWidthBasis;
    }
    return v;
  }

  /**
   * @param config config: 
    {
      key?:Key,
      style?:TextStyle,
      textAlign?:TextAlign,
      textDirection?:TextDirection,
      softWrap?:boolean,
      overflow?:TextOverflow,
      textScaleFactor?:number,
      maxLines?:number,
      semanticsLabel?:string,
      textWidthBasis?:TextWidthBasis,
    }
   */
  static rich(textSpan:TextSpan, config?: TextConfig) {
    var v = new Text();
    v.textSpan = textSpan;
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.style = config.style;
      v.textAlign = config.textAlign;
      v.textDirection = config.textDirection;
      v.softWrap = config.softWrap;
      v.overflow = config.overflow;
      v.textScaleFactor = config.textScaleFactor;
      v.maxLines = config.maxLines;
      v.semanticsLabel = config.semanticsLabel;
      v.textWidthBasis = config.textWidthBasis;
    }
    return v;
  }
}

//****** TextSpan ******
//TODO:recognizer => GestureRecognizer
interface TextSpanConfig {
  children?:Array<FlutterWidget>;
  style?:TextStyle;
  text?:string;
  recognizer?:any;
  semanticsLabel?:string;
}
export class TextSpan extends FlutterWidget {
  children?:Array<FlutterWidget>;
  style?:TextStyle;
  text?:string;
  recognizer?:any;
  semanticsLabel?:string;


  /**
   * @param config config: 
    {
      children?:Array<FlutterWidget>, 
      style?:TextStyle, 
      text?:string, 
      recognizer?:any, 
      semanticsLabel?:string,
    }
   */
  static new(config: TextSpanConfig) {
    var v = new TextSpan();
    if(config!=null && config!=undefined){
      v.children = config.children;
      v.style = config.style;
      v.text = config.text;
      v.recognizer = config.recognizer;
      v.semanticsLabel = config.semanticsLabel;
    }
    return v;
  }
}


//****** TODO Texture ******
interface TextureConfig {
  key?:Key;
  textureId?:number;
  filterQuality?:FilterQuality;
}
export class Texture extends FlutterWidget {
  key?:Key;
  textureId?:number;
  filterQuality?:FilterQuality;


  /**
   * @param config config: 
    {
      key?:Key, 
      textureId?:number, 
      filterQuality?:FilterQuality, 
    }
   */
  static new(config: TextureConfig) {
    var v = new Texture();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.textureId = config.textureId;
      v.filterQuality = config.filterQuality;
    }
    return v;
  }
}

//****** TODO TextFormField ******
interface TextFormFieldConfig {
  key?:Key;
  controller?:TextEditingController;
  initialValue?:string;
  focusNode?:any;
  decoration?:InputDecoration;
  keyboardType?:TextInputType;
  textCapitalization?:TextCapitalization;
  textInputAction?:TextInputAction;
  style?:TextStyle;
  textDirection?:TextDirection;
  textAlign?:TextAlign;
  autofocus?:boolean;
  obscureText?:boolean;
  autocorrect?:boolean;
  autovalidate?:boolean;
  maxLengthEnforced?:boolean;
  maxLines?:number;
  maxLength?:number;
  onEditingComplete?:VoidCallback;
  onFieldSubmitted?:VoidValueChangedString;
  onSaved?:VoidValueChangedString;
  validator?:VoidValueChangedString;
  inputFormatters?:any;
  enabled?:boolean;
  cursorWidth?:number;
  cursorRadius?:Radius;
  cursorColor?:Color;
  keyboardAppearance?:Brightness;
  scrollPadding?:EdgeInsets;
  enableInteractiveSelection?:boolean;
  buildCounter?:any;
  
}
export class TextFormField extends FlutterWidget {
  controller?:TextEditingController;
  initialValue?:string;
  focusNode?:any;
  decoration?:InputDecoration;
  keyboardType?:TextInputType;
  textCapitalization?:TextCapitalization;
  textInputAction?:TextInputAction;
  style?:TextStyle;
  textDirection?:TextDirection;
  textAlign?:TextAlign;
  autofocus?:boolean;
  obscureText?:boolean;
  autocorrect?:boolean;
  autovalidate?:boolean;
  maxLengthEnforced?:boolean;
  maxLines?:number;
  maxLength?:number;
  onEditingComplete?:VoidCallback;
  onFieldSubmitted?:VoidValueChangedString;
  onSaved?:VoidValueChangedString;
  validator?:VoidValueChangedString;
  inputFormatters?:any;
  enabled?:boolean;
  cursorWidth?:number;
  cursorRadius?:Radius;
  cursorColor?:Color;
  keyboardAppearance?:Brightness;
  scrollPadding?:EdgeInsets;
  enableInteractiveSelection?:boolean;
  buildCounter?:any;
  key?:Key;

  /**
   * @param config config: 
    {
      key?:Key, 
      controller?:TextEditingController, 
      initialValue?:string, 
      focusNode?:any, 
      decoration?:InputDecoration, 
      keyboardType?:TextInputType, 
      textCapitalization?:TextCapitalization, 
      textInputAction?:TextInputAction, 
      style?:TextStyle, 
      textDirection?:TextDirection, 
      textAlign?:TextAlign, 
      autofocus?:boolean, 
      obscureText?:boolean, 
      autocorrect?:boolean, 
      autovalidate?:boolean, 
      maxLengthEnforced?:boolean, 
      maxLines?:number, 
      maxLength?:number, 
      onEditingComplete?:VoidCallback, 
      onFieldSubmitted?:VoidValueChangedString, 
      onSaved?:VoidValueChangedString, 
      validator?:VoidValueChangedString, 
      inputFormatters?:any, 
      enabled?:boolean, 
      cursorWidth?:number, 
      cursorRadius?:Radius, 
      cursorColor?:Color, 
      keyboardAppearance?:Brightness, 
      scrollPadding?:EdgeInsets, 
      enableInteractiveSelection?:boolean, 
      buildCounter?:any,       
    }
   */
  static new(config: TextFormFieldConfig) {
    var v = new TextFormField();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.controller = config.controller;
      v.initialValue = config.initialValue;
      v.focusNode = config.focusNode;
      v.decoration = config.decoration;
      v.keyboardType = config.keyboardType;
      v.textCapitalization = config.textCapitalization;
      v.textInputAction = config.textInputAction;
      v.style = config.style;
      v.textDirection = config.textDirection;
      v.textAlign = config.textAlign;
      v.autofocus = config.autofocus;
      v.obscureText = config.obscureText;
      v.autocorrect = config.autocorrect;
      v.autovalidate = config.autovalidate;
      v.maxLengthEnforced = config.maxLengthEnforced;
      v.maxLines = config.maxLines;
      v.maxLength = config.maxLength;
      v.onEditingComplete = config.onEditingComplete;
      v.onFieldSubmitted = config.onFieldSubmitted;
      v.onSaved = config.onSaved;
      v.validator = config.validator;
      v.inputFormatters = config.inputFormatters;
      v.enabled = config.enabled;
      v.cursorWidth = config.cursorWidth;
      v.cursorRadius = config.cursorRadius;
      v.cursorColor = config.cursorColor;
      v.keyboardAppearance = config.keyboardAppearance;
      v.scrollPadding = config.scrollPadding;
      v.enableInteractiveSelection = config.enableInteractiveSelection;
      v.buildCounter = config.buildCounter;
    }
    return v;
  }
}
//#endregion

//#region ------- U -------
//****** UnconstrainedBox ******
interface UnconstrainedBoxConfig {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  textDirection?:TextDirection;
  constrainedAxis?:Axis;
  clipBehavior?:Clip;
}
export class UnconstrainedBox extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  alignment?:Alignment;
  textDirection?:TextDirection;
  constrainedAxis?:Axis;
  clipBehavior?:Clip;

  /**
   * @param config config: 
      {
        key?:Key, 
        child?:FlutterWidget, 
        alignment?:Alignment;
        textDirection?:TextDirection, 
        constrainedAxis?:Axis, 
        clipBehavior?:Clip, 
      }
   */
  static new(config: UnconstrainedBoxConfig) {
    var v = new UnconstrainedBox();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.alignment = config.alignment;
      v.textDirection = config.textDirection;
      v.constrainedAxis = config.constrainedAxis;
      v.clipBehavior = config.clipBehavior;
    }
    return v;
  }

}
//#endregion

//#region ------- V -------
//****** VerticalDivider ******
interface VerticalDividerConfig {
  key?:Key;
  width?:number;
  thickness?:number;
  indent?:number;
  endIndent?:number;
  color?:Color;
}
export class VerticalDivider extends FlutterWidget {
  key?:Key;
  width?:number;
  thickness?:number;
  indent?:number;
  endIndent?:number;
  color?:Color;

  /**
   * @param config config: 
    {
      key?:Key, 
      width?:number, 
      thickness?:number, 
      indent?:number, 
      endIndent?:number, 
      color?:Color 
    }
  */
  static new(config: VerticalDividerConfig) {
    var v = new VerticalDivider();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.width = config.width;
      v.thickness = config.thickness;
      v.indent = config.indent;
      v.endIndent = config.endIndent;
      v.color = config.color;
    }
    return v;
  }
}

//****** Visibility ******
interface VisibilityConfig {
  child:FlutterWidget;

  key?:Key;
  replacement?:FlutterWidget;
  visible?:boolean;
  maintainState?:boolean;
  maintainAnimation?:boolean;
  maintainSize?:boolean;
  maintainSemantics?:boolean;
  maintainInteractivity?:boolean;
}
export class Visibility extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  replacement?:FlutterWidget;
  visible?:boolean;
  maintainState?:boolean;
  maintainAnimation?:boolean;
  maintainSize?:boolean;
  maintainSemantics?:boolean;
  maintainInteractivity?:boolean;

  /**
   * @param config config: 
    {
      child:FlutterWidget, 

      key?:Key, 
      replacement?:FlutterWidget, 
      visible?:boolean, 
      maintainState?:boolean, 
      maintainAnimation?:boolean, 
      maintainSize?:boolean, 
      maintainSemantics?:boolean, 
      maintainInteractivity?:boolean, 
    }
  */
  static new(config: VisibilityConfig) {
    var v = new Visibility();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.replacement = config.replacement;
      v.visible = config.visible;
      v.maintainAnimation = config.maintainAnimation;
      v.maintainState = config.maintainState;
      v.maintainSize = config.maintainSize;
      v.maintainSemantics = config.maintainSemantics;
      v.maintainInteractivity = config.maintainInteractivity;
    }
    return v;
  }
}

//#endregion

//#region ------- W -------
//****** Wrap ******
interface WrapConfig {
  key?:Key;
  children?:Array<FlutterWidget>;
  alignment?:WrapAlignment;
  spacing?:number;
  crossAxisAlignment?:WrapCrossAlignment;
  textDirection?:TextDecoration;
  direction?:Axis;
  verticalDirection?:VerticalDirection;
  runAlignment?:WrapAlignment;
  runSpacing?:number; 
  clipBehavior?:Clip;
}
export class Wrap extends FlutterWidget {
  children?:Array<FlutterWidget>;
  alignment?:WrapAlignment;
  spacing?:number;
  crossAxisAlignment?:WrapCrossAlignment;
  textDirection?:TextDecoration;
  direction?:Axis;
  verticalDirection?:VerticalDirection;
  runAlignment?:WrapAlignment;
  runSpacing?:number; 
  key?:Key;
  clipBehavior?:Clip;

  /**
   * @param config config: 
    {
      key?:Key, 
      children?:Array<FlutterWidget>, 
      alignment?:WrapAlignment, 
      spacing?:number, 
      crossAxisAlignment?:WrapCrossAlignment, 
      textDirection?:TextDecoration, 
      direction?:Axis, 
      verticalDirection?:VerticalDirection, 
      runAlignment?:WrapAlignment, 
      runSpacing?:number,     
      clipBehavior?:Clip, 
    }
   */
  static new(config: WrapConfig) {
      var v = new Wrap();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.direction = config.direction;
        v.alignment = config.alignment;
        v.spacing = config.spacing;
        v.runAlignment = config.runAlignment;
        v.runSpacing = config.runSpacing;
        v.crossAxisAlignment = config.crossAxisAlignment;
        v.textDirection = config.textDirection;
        v.verticalDirection = config.verticalDirection;
        v.children = config.children;
        v.clipBehavior = config.clipBehavior;
      }
    return v;
  }
}

//****** WillPopScope ******
interface WillPopScopeConfig {
  child:FlutterWidget;
  onWillPop:VoidCallback;

  key?:Key;
}
export class WillPopScope extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  onWillPop?:VoidCallback;

  /**
   * @param config config: 
    {
      child:FlutterWidget, 
      onWillPop:VoidCallback, 

      key?:Key, 
    }
   */
  static new(config: WillPopScopeConfig) {
      var v = new WillPopScope();
      if(config!=null && config!=undefined){
        v.key = config.key;
        v.child = config.child;
        v.onWillPop = config.onWillPop;
      }
    return v;
  }
}

//****** WidgetSpan ******
interface WidgetSpanConfig {
  child:FlutterWidget;

  alignment?:PlaceholderAlignment;
  baseline?:TextBaseline;
  style?:TextStyle;
}
export class WidgetSpan extends FlutterWidget {
  child?:FlutterWidget;
  alignment?:PlaceholderAlignment;
  baseline?:TextBaseline;
  style?:TextStyle;

  /**
   * @param config config: 
    {
      child:FlutterWidget, 

      alignment?:PlaceholderAlignment, 
      baseline?:TextBaseline, 
      style?:TextStyle, 
    }
   */
  static new(config: WidgetSpanConfig) {
      var v = new WidgetSpan();
      if(config!=null && config!=undefined){
        v.child = config.child;
        v.alignment = config.alignment;
        v.baseline = config.baseline;
        v.style = config.style;
      }
    return v;
  }

}

//#endregion

//#endregion


//#region ******* Cupertino widgets ********
//-------------- A -----------------
//****** CupertinoActivityIndicator ******
interface CupertinoActivityIndicatorConfig {
  key?:Key;
  animating?:boolean;
  radius?:number;
}
export class CupertinoActivityIndicator extends FlutterWidget {
  key?:Key;
  animating?:boolean;
  radius?:number;

  /**
   * @param config config: 
      {
        key?:Key, 
        animating?:boolean, 
        radius?:number, 
      }
   */
  static new(config: CupertinoActivityIndicatorConfig) {
    var v = new CupertinoActivityIndicator();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.animating = config.animating;
      v.radius = config.radius;
    }
    return v;
  }
}

//-------------- B -----------------
//****** CupertinoButton ******
interface CupertinoButtonConfig {
  key?:Key;
  child:FlutterWidget;
  onPressed:VoidCallback;
  padding?:EdgeInsets;
  color?:Color;
  disabledColor?:Color;
  minSize?:number;
  pressedOpacity?:number;
  borderRadius?:BorderRadius;
}
export class CupertinoButton extends FlutterWidget {
  child?:FlutterWidget;
  onPressed?:VoidCallback;
  padding?:EdgeInsets;
  color?:Color;
  disabledColor?:Color;
  minSize?:number;
  pressedOpacity?:number;
  borderRadius?:BorderRadius;
  key?:Key;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        onPressed:VoidCallback, 
        padding?:EdgeInsets, 
        color?:Color, 
        disabledColor?:Color, 
        minSize?:number, 
        pressedOpacity?:number, 
        borderRadius?:BorderRadius, 
      }
   */
  static new(config: CupertinoButtonConfig) {
    var v = new CupertinoButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.padding = config.padding;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.minSize = config.minSize;
      v.pressedOpacity = config.pressedOpacity;
      v.onPressed = config.onPressed;
    }
    return v;
  }

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        onPressed:VoidCallback, 
        padding?:EdgeInsets, 
        disabledColor?:Color, 
        minSize?:number, 
        pressedOpacity?:number, 
        borderRadius?:BorderRadius, 
      }
   */
  static filled(config: CupertinoButtonConfig) {
    var v = new CupertinoButton();
    v.constructorName = "filled";
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.padding = config.padding;
      v.color = config.color;
      v.disabledColor = config.disabledColor;
      v.minSize = config.minSize;
      v.pressedOpacity = config.pressedOpacity;
      v.onPressed = config.onPressed;
    }
    return v;
  }
}

//-------------- D -----------------


//-------------- F -----------------


//-------------- N -----------------
//****** CupertinoNavigationBar ******
interface CupertinoNavigationBarConfig {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  automaticallyImplyMiddle?:boolean;
  previousPageTitle?:string;
  middle?:FlutterWidget;
  trailing?:FlutterWidget;
  border?:Border;
  backgroundColor?:Color;
  brightness?:Brightness;
  padding?:EdgeInsets;
  actionsForegroundColor?:Color;
  transitionBetweenRoutes?:boolean;
}
export class CupertinoNavigationBar extends FlutterWidget {
  key?:Key;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  automaticallyImplyMiddle?:boolean;
  previousPageTitle?:string;
  middle?:FlutterWidget;
  trailing?:FlutterWidget;
  border?:Border;
  backgroundColor?:Color;
  brightness?:Brightness;
  padding?:EdgeInsets;
  actionsForegroundColor?:Color;
  transitionBetweenRoutes?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        leading?:FlutterWidget, 
        automaticallyImplyLeading?:boolean, 
        automaticallyImplyMiddle?:boolean, 
        previousPageTitle?:string, 
        middle?:FlutterWidget, 
        trailing?:FlutterWidget, 
        border?:Border, 
        backgroundColor?:Color, 
        brightness?:Brightness, 
        padding?:EdgeInsets, 
        actionsForegroundColor?:Color, 
        transitionBetweenRoutes?:boolean, 
      }
   */
  static new(config: CupertinoNavigationBarConfig) {
    var v = new CupertinoNavigationBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.leading = config.leading;
      v.automaticallyImplyLeading = config.automaticallyImplyLeading;
      v.automaticallyImplyMiddle = config.automaticallyImplyMiddle;
      v.previousPageTitle = config.previousPageTitle;
      v.middle = config.middle;
      v.trailing = config.trailing;
      v.border = config.border;
      v.backgroundColor = config.backgroundColor;
      v.brightness = config.brightness;
      v.padding = config.padding;
      v.actionsForegroundColor = config.actionsForegroundColor;
      v.transitionBetweenRoutes = config.transitionBetweenRoutes;
    }
    return v;
  }
}

//****** CupertinoNavigationBarBackButton ******
interface CupertinoNavigationBarBackButtonConfig {
  key?:Key;
  color?:Color;
  previousPageTitle?:string;
  onPressed?:VoidCallback;
}
export class CupertinoNavigationBarBackButton extends FlutterWidget {
  key?:Key;
  color?:Color;
  previousPageTitle?:string;
  onPressed?:VoidCallback;

  /**
   * @param config config: 
      {
        key?:Key, 
        color?:Color, 
        previousPageTitle?:string, 
        onPressed?:VoidCallback, 
      }
   */
  static new(config:CupertinoNavigationBarBackButtonConfig) {
    var v = new CupertinoNavigationBarBackButton();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.color = config.color;
      v.previousPageTitle= config.previousPageTitle;
      v.onPressed =config.onPressed;
    }
    return v;
  }
}

//-------------- P -----------------

//-------------- S -----------------
//****** CupertinoSlider ******
interface CupertinoSliderConfig {
  key?:Key;
  value:number;
  onChanged:VoidValueChangedNumber;
  onChangeStart?:VoidValueChangedNumber;
  onChangeEnd?:VoidValueChangedNumber;
  min?:number;
  max?:number;
  divisions?:number;
  activeColor?:Color;
  thumbColor?:Color;
}
export class CupertinoSlider extends FlutterWidget {
  key?:Key;
  value?:number;
  onChanged?:VoidValueChangedNumber;
  onChangeStart?:VoidValueChangedNumber;
  onChangeEnd?:VoidValueChangedNumber;
  min?:number;
  max?:number;
  divisions?:number;
  activeColor?:Color;
  thumbColor?:Color;

  /**
   * @param config config: 
      {
        key?:Key, 
        value:number, 
        onChanged:VoidValueChangedNumber, 
        onChangeStart?:VoidValueChangedNumber, 
        onChangeEnd?:VoidValueChangedNumber, 
        min?:number, 
        max?:number, 
        divisions?:number, 
        activeColor?:Color, 
        thumbColor?:Color, 
      }
   */
  static new(config: CupertinoSliderConfig) {
    var v = new CupertinoSlider();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.onChangeStart = config.onChangeStart;
      v.onChangeEnd = config.onChangeEnd;
      v.min = config.min;
      v.max = config.max;
      v.divisions = config.divisions;
      v.activeColor = config.activeColor;
      v.thumbColor = config.thumbColor;
    }
    return v;
  }
}

//****** CupertinoSwitch ******
interface CupertinoSwitchConfig {
  key?:Key;
  value:boolean;
  onChanged:VoidValueChangedBoolean;
  activeColor?:Color;
  trackColor?:Color;
  dragStartBehavior?:DragStartBehavior;
}
export class CupertinoSwitch extends FlutterWidget {
  key?:Key;
  value?:boolean;
  onChanged?:VoidValueChangedBoolean;
  activeColor?:Color;
  trackColor?:Color;
  dragStartBehavior?:DragStartBehavior;

  /**
   * @param config config: 
      {
        key?:Key, 
        value:boolean, 
        onChanged:VoidValueChangedBoolean, 
        activeColor?:Color, 
        trackColor?:Color, 
        dragStartBehavior?:DragStartBehavior, 
      }
   */
  static new(config: CupertinoSwitchConfig) {
    var v = new CupertinoSwitch();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.value = config.value;
      v.onChanged = config.onChanged;
      v.activeColor = config.activeColor;
      v.trackColor = config.trackColor;
      v.dragStartBehavior = config.dragStartBehavior;
    }
    return v;
  }
}

//****** CupertinoScrollbar ******
interface CupertinoScrollbarConfig {
  key?:Key;
  child:FlutterWidget;
  controller?:ScrollController;
  isAlwaysShown?:boolean;
}
export class CupertinoScrollbar extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  controller?:ScrollController;
  isAlwaysShown?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        controller?:ScrollController, 
        isAlwaysShown?:boolean, 
      }
   */
  static new(config: CupertinoScrollbarConfig) {
    var v = new CupertinoScrollbar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.controller = config.controller;
      v.isAlwaysShown = config.isAlwaysShown;
    }
    return v;
  }
}

//****** CupertinoSliverNavigationBar ******
interface CupertinoSliverNavigationBarConfig {
  key?:Key;
  largeTitle?:FlutterWidget;
  leading?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  automaticallyImplyTitle?:boolean;
  previousPageTitle?:string;
  middle?:FlutterWidget;
  trailing?:FlutterWidget;
  border?:Border;
  backgroundColor?:Color;
  brightness?:Brightness;
  padding?:EdgeInsets;
  actionsForegroundColor?:Color;
  transitionBetweenRoutes?:boolean;
}
export class CupertinoSliverNavigationBar extends FlutterWidget {
  key?:Key;
  leading?:FlutterWidget;
  largeTitle?:FlutterWidget;
  automaticallyImplyLeading?:boolean;
  automaticallyImplyTitle?:boolean;
  previousPageTitle?:string;
  middle?:FlutterWidget;
  trailing?:FlutterWidget;
  border?:Border;
  backgroundColor?:Color;
  brightness?:Brightness;
  padding?:EdgeInsets;
  actionsForegroundColor?:Color;
  transitionBetweenRoutes?:boolean;

  /**
   * @param config config: 
      {
        key?:Key, 
        leading?:FlutterWidget, 
        largeTitle?:FlutterWidget, 
        automaticallyImplyLeading?:boolean, 
        automaticallyImplyTitle?:boolean, 
        previousPageTitle?:string, 
        middle?:FlutterWidget, 
        trailing?:FlutterWidget, 
        border?:Border, 
        backgroundColor?:Color, 
        brightness?:Brightness, 
        padding?:EdgeInsets, 
        actionsForegroundColor?:Color, 
        transitionBetweenRoutes?:boolean, 
      }
   */
  static new(config: CupertinoSliverNavigationBarConfig) {
    var v = new CupertinoSliverNavigationBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.leading = config.leading;
      v.largeTitle = config.largeTitle;
      v.automaticallyImplyLeading = config.automaticallyImplyLeading;
      v.automaticallyImplyTitle = config.automaticallyImplyTitle;
      v.previousPageTitle = config.previousPageTitle;
      v.middle = config.middle;
      v.trailing = config.trailing;
      v.border = config.border;
      v.backgroundColor = config.backgroundColor;
      v.brightness = config.brightness;
      v.padding = config.padding;
      v.actionsForegroundColor = config.actionsForegroundColor;
      v.transitionBetweenRoutes = config.transitionBetweenRoutes;
    }
    return v;
  }
}

//-------------- T -----------------
//****** CupertinoTabBar ******
interface CupertinoTabBarConfig {
  key?:Key;
  items:Array<BottomNavigationBarItem>;
  onTap?:VoidValueChangedNumber;
  currentIndex?:number;
  backgroundColor?:Color;
  activeColor?:Color;
  inactiveColor?:Color;
  iconSize?:number;
  border?:Border;
}
export class CupertinoTabBar extends FlutterWidget {
  key?:Key;
  items?:Array<BottomNavigationBarItem>;
  onTap?:VoidValueChangedNumber;
  currentIndex?:number;
  backgroundColor?:Color;
  activeColor?:Color;
  inactiveColor?:Color;
  iconSize?:number;
  border?:Border;

  /**
   * @param config config: 
      {
        key?:Key, 
        items:Array<BottomNavigationBarItem>, 
        onTap?:VoidValueChangedNumber, 
        currentIndex?:number, 
        backgroundColor?:Color, 
        activeColor?:Color, 
        inactiveColor?:Color, 
        iconSize?:number, 
        border?:Border, 
      }
   */
  static new(config: CupertinoTabBarConfig) {
    var v = new CupertinoTabBar();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.items = config.items;
      v.onTap = config.onTap;
      v.currentIndex = config.currentIndex;
      v.backgroundColor = config.backgroundColor;
      v.activeColor = config.activeColor;
      v.inactiveColor = config.inactiveColor;
      v.iconSize = config.iconSize;
      v.border = config.border;
    }
    return v;
  }
}
//****** CupertinoTabController ******
interface CupertinoTabControllerConfig {
  initialIndex?:number;
}
export class CupertinoTabController extends DartClass {
  initialIndex?:number;

  /**
   * @param config config: 
      {
        initialIndex?:number, 
      }
   */
  static new(config: CupertinoTabControllerConfig) {
    var v = new CupertinoTabController();
    if(config!=null && config!=undefined){
      v.initialIndex = config.initialIndex;
    }
    return v;
  }
}


//****** CupertinoTheme ******
interface CupertinoThemeConfig {
  key?:Key;
  child:FlutterWidget;
  data:CupertinoThemeData;
}
export class CupertinoTheme extends FlutterWidget {
  key?:Key;
  child?:FlutterWidget;
  data?:CupertinoThemeData;

  /**
   * @param config config: 
      {
        key?:Key, 
        child:FlutterWidget, 
        data:CupertinoThemeData, 
      }
   */
  static new(config: CupertinoThemeConfig) {
    var v = new CupertinoTheme();
    if(config!=null && config!=undefined){
      v.key = config.key;
      v.child = config.child;
      v.data = config.data;
    }
    return v;
  }
}

//****** CupertinoTextThemeData ******
interface CupertinoTextThemeDataConfig {
  primaryColor?:Color;
  textStyle?:TextStyle;
  actionTextStyle?:TextStyle;
  tabLabelTextStyle?:TextStyle;
  navTitleTextStyle?:TextStyle;
  navLargeTitleTextStyle?:TextStyle;
  navActionTextStyle?:TextStyle;
  pickerTextStyle?:TextStyle;
  dateTimePickerTextStyle?:TextStyle;
}
export class CupertinoTextThemeData extends DartClass {
  primaryColor?:Color;
  textStyle?:TextStyle;
  actionTextStyle?:TextStyle;
  tabLabelTextStyle?:TextStyle;
  navTitleTextStyle?:TextStyle;
  navLargeTitleTextStyle?:TextStyle;
  navActionTextStyle?:TextStyle;
  pickerTextStyle?:TextStyle;
  dateTimePickerTextStyle?:TextStyle;

  /**
   * @param config config: 
      {
        primaryColor?:Color, 
        textStyle?:TextStyle, 
        actionTextStyle?:TextStyle, 
        tabLabelTextStyle?:TextStyle, 
        navTitleTextStyle?:TextStyle, 
        navLargeTitleTextStyle?:TextStyle, 
        navActionTextStyle?:TextStyle, 
        pickerTextStyle?:TextStyle, 
        dateTimePickerTextStyle?:TextStyle, 
      }
   */
  static new(config: CupertinoTextThemeDataConfig) {
    var v = new CupertinoTextThemeData();
    if(config!=null && config!=undefined){
      v.primaryColor = config.primaryColor;
      v.textStyle = config.textStyle;
      v.actionTextStyle = config.actionTextStyle;
      v.tabLabelTextStyle = config.tabLabelTextStyle;
      v.navActionTextStyle = config.navActionTextStyle;
      v.navLargeTitleTextStyle = config.navLargeTitleTextStyle;
      v.navTitleTextStyle = config.navTitleTextStyle;
      v.pickerTextStyle = config.pickerTextStyle;
      v.dateTimePickerTextStyle = config.dateTimePickerTextStyle;
    }
    return v;
  }
}

//****** CupertinoThemeData ******
interface CupertinoThemeDataConfig {
  primaryColor?:Color;
  brightness?:Brightness;
  primaryContrastingColor?:Color;
  textTheme?:CupertinoTextThemeData;
  barBackgroundColor?:Color;
  scaffoldBackgroundColor?:Color;
}
export class CupertinoThemeData extends DartClass {
  primaryColor?:Color;
  brightness?:Brightness;
  primaryContrastingColor?:Color;
  textTheme?:CupertinoTextThemeData;
  barBackgroundColor?:Color;
  scaffoldBackgroundColor?:Color;
  /**
   * @param config config: 
      {
        primaryColor?:Color, 
        brightness?:Brightness, 
        primaryContrastingColor?:Color, 
        textTheme?:CupertinoTextThemeData, 
        barBackgroundColor?:Color, 
        scaffoldBackgroundColor?:Color, 
      }
   */
  static new(config: CupertinoThemeDataConfig) {
    var v = new CupertinoThemeData();
    if(config!=null && config!=undefined){
      v.primaryColor = config.primaryColor;
      v.brightness = config.brightness;
      v.primaryContrastingColor = config.primaryContrastingColor;
      v.textTheme = config.textTheme;
      v.barBackgroundColor = config.barBackgroundColor;
      v.scaffoldBackgroundColor = config.scaffoldBackgroundColor;
    }
    return v;
  }
}


//#endregion