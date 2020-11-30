//  XSFlutterFramework
//  Copyright 2019 The XSFlutter Authors. All rights reserved.
//
//  Use of this source code is governed by a MIT-style license that can be
//  found in the LICENSE file.

import 'package:flutter/material.dart';
import 'package:xsflutter/xsflutter.dart';
import 'xs_js_parse.dart';
import 'xs_json_to_dart.dart';
import 'loading/loading.dart';
import 'common/sp_util.dart';
import 'common/package_info.dart';

///把Widget初始化用到的基础类型如 List, ，
class XSProxyRegisterHelperPackageSeries {
  static Map<String, CreateJsonObjProxyFun> registerProxys() {
    Map<String, CreateJsonObjProxyFun> m = {};

    m.addAll(XSProxyLoading.registerProxy());
    m.addAll(XSProxySp.registerProxy());
    m.addAll(XSProxyScreenInfo.registerProxy());
    m.addAll(XSProxyPackageInfo.registerProxy());
    return m;
  }
}

//-------------- L -----------------
//****** XSLoading ******
class XSProxyLoading extends XSJsonObjProxy {
  static Map<String, CreateJsonObjProxyFun> registerProxy() {
    final String regClassName = "LoadingApi";
    return {
      regClassName: () => XSProxyLoading()..init(className: regClassName)
    };
  }

  @override
  Object constructor(dynamic bo, Map<String, dynamic> jsonMap, {dynamic context}) {
    return Object();
  }

  @override
  void jsInvokeMirrorObjFunction(String mirrorID, dynamic mirrorObj, String funcName, Map map, {InvokeCallback callback}) {
    if (mirrorObj == null) return;
    switch (funcName) {
      case 'dismiss':
        return XSLoading.dismiss(animation: XSJSParse.getBool(null, null, map, "animation", defaultValue: true));
      case 'show':
        return XSLoading.show(
          status: XSJSParse.getString(null, null, map, "info"),
          indicator: XSJSParse.getWidget(null, null, map, "indicator"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
      case 'showError':
        return XSLoading.showError(
          XSJSParse.getString(null, null, map, "info"),
          duration: XSJSParse.getDuration(null, null, map, "duration"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
      case 'showInfo':
        return XSLoading.showInfo(
          XSJSParse.getString(null, null, map, "info"),
          duration: XSJSParse.getDuration(null, null, map, "duration"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
      case 'showSuccess':
        return XSLoading.showSuccess(
          XSJSParse.getString(null, null, map, "info"),
          duration: XSJSParse.getDuration(null, null, map, "duration"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
      case 'showToast':
        return XSLoading.showToast(
          XSJSParse.getString(null, null, map, "info"),
          duration: XSJSParse.getDuration(null, null, map, "duration"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
      case 'showProgress':
        return XSLoading.showProgress(
          XSJSParse.getDouble(null, null, map, "value"),
          status: XSJSParse.getString(null, null, map, "info"),
          alignment: XSJSParse.getAlignment(null, null, map, "alignment", defaultValue: Alignment.center),
        );
    }
  }
}

//-------------- S -----------------
//****** SpApi ******
class XSProxySp extends XSJsonObjProxy {
  static Map<String, CreateJsonObjProxyFun> registerProxy() {
    final String regClassName = "SpApi";
    return {
      regClassName: () => XSProxySp()..init(className: regClassName)
    };
  }

  @override
  Object constructor(dynamic bo, Map<String, dynamic> jsonMap, {dynamic context}) {
    return Object();
  }

  @override
  void jsInvokeMirrorObjFunction(String mirrorID, dynamic mirrorObj, String funcName, Map map, {InvokeCallback callback}) {
    if (mirrorObj == null) return;
    var result;
    switch (funcName) {
      case 'getBool':
        result = XSSpUtil.getBool(
          XSJSParse.getString(null, null, map, "key"),
          defaultValue: XSJSParse.getBool(null, null, map, "defaultValue"),
        );
        break;
      case 'getDouble':
        result = XSSpUtil.getDouble(
          XSJSParse.getString(null, null, map, "key"),
          defaultValue: XSJSParse.getDouble(null, null, map, "defaultValue"),
        );
        break;
      case 'getInt':
        result = XSSpUtil.getInt(
          XSJSParse.getString(null, null, map, "key"),
          defaultValue: XSJSParse.getInt(null, null, map, "defaultValue"),
        );
        break;
      case 'getString':
        result = XSSpUtil.getString(
          XSJSParse.getString(null, null, map, "key"),
          defaultValue: XSJSParse.getString(null, null, map, "defaultValue"),
        );
        break;

      case 'clear':
        result = XSSpUtil.clear();
        break;
      case 'remove':
        result = XSSpUtil.remove(XSJSParse.getString(null, null, map, "key"));
        break;

      case 'setBool':
        result = XSSpUtil.putBool(
          XSJSParse.getString(null, null, map, "key"),
          XSJSParse.getBool(null, null, map, "value"),
        );
        break;

      case 'setDouble':
        result = XSSpUtil.putDouble(
          XSJSParse.getString(null, null, map, "key"),
          XSJSParse.getDouble(null, null, map, "value"),
        );
        break;
      case 'setInt':
        result = XSSpUtil.putInt(
          XSJSParse.getString(null, null, map, "key"),
          XSJSParse.getInt(null, null, map, "value"),
        );
        break;
      case 'setString':
        result = XSSpUtil.putString(
          XSJSParse.getString(null, null, map, "key"),
          XSJSParse.getString(null, null, map, "value"),
        );
        break;
    }

    if (callback != null && result != null) {
      callback(result);
    }
  }
}

//****** ScreenInfo ******
class XSProxyScreenInfo extends XSJsonObjProxy {
  static Map<String, CreateJsonObjProxyFun> registerProxy() {
    final String regClassName = "ScreenInfo";
    return {
      regClassName: () => XSProxyScreenInfo()..init(className: regClassName)
    };
  }

  @override
  Object constructor(dynamic bo, Map<String, dynamic> jsonMap, {dynamic context}) {
    return Object();
  }

  @override
  void jsInvokeMirrorObjFunction(String mirrorID, dynamic mirrorObj, String funcName, Map map, {InvokeCallback callback}) {
    if (mirrorObj == null) return;
    var result;
    switch (funcName) {
      case 'updateInfo':
        result = {
          "appBarHeight": XSScreenInfo.appBarHeight,
          "bottomBarHeight": XSScreenInfo.bottomBarHeight,
          "dpRatio": XSScreenInfo.dpRatio,
          "pxRatio": XSScreenInfo.pxRatio,
          "screenDensity": XSScreenInfo.screenDensity,
          "screenHeight": XSScreenInfo.screenHeight,
          "screenHeightPx": XSScreenInfo.screenHeightPx,
          "screenWidth": XSScreenInfo.screenWidth,
          "screenWidthPx": XSScreenInfo.screenWidthPx,
          "statusBarHeight": XSScreenInfo.statusBarHeight,
          "textScaleFactor": XSScreenInfo.textScaleFactor,
          "uiDensity": XSScreenInfo.uiDensity,
          "uiHeight": XSScreenInfo.uiHeight,
          "uiHeightPx": XSScreenInfo.uiHeightPx,
          "uiWidth": XSScreenInfo.uiWidth,
          "uiWidthPx": XSScreenInfo.uiWidthPx,
        };
        break;
    }

    if (callback != null && result != null) {
      callback(result);
    }
  }
}

//****** PackageInfo ******
class XSProxyPackageInfo extends XSJsonObjProxy {
  static Map<String, CreateJsonObjProxyFun> registerProxy() {
    final String regClassName = "PackageInfo";
    return {
      regClassName: () => XSProxyPackageInfo()..init(className: regClassName)
    };
  }

  @override
  Object constructor(dynamic bo, Map<String, dynamic> jsonMap, {dynamic context}) {
    return Object();
  }

  @override
  void jsInvokeMirrorObjFunction(String mirrorID, dynamic mirrorObj, String funcName, Map map, {InvokeCallback callback}) {
    if (mirrorObj == null) return;
    var result;
    switch (funcName) {
      case 'updateInfo':
        result = {
          "appName": XSPackageInfo.appName,
          "buildNumber": XSPackageInfo.buildNumber,
          "packageName": XSPackageInfo.packageName,
          "version": XSPackageInfo.version
        };
        break;
    }

    if (callback != null && result != null) {
      callback(result);
    }
  }
}
