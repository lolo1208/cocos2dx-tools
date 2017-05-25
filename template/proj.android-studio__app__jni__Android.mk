LOCAL_PATH := $(call my-dir)

include $(CLEAR_VARS)

LOCAL_MODULE := cocos2djs_shared

LOCAL_MODULE_FILENAME := libcocos2djs


# 递归查找文件夹下的所有文件
define get-all-files
    $(wildcard $(1)) $(foreach e, $(wildcard $(1)/*), $(call get-all-files, $(e)))
endef


# 添加C++文件
ALL_FILES = $(call get-all-files, $(LOCAL_PATH)/../../../Classes)
CPP_FILE_LIST := hellojavascript/main.cpp
CPP_FILE_LIST += $(filter %.cpp, $(ALL_FILES))
LOCAL_SRC_FILES := $(CPP_FILE_LIST:$(LOCAL_PATH)/%=%)


LOCAL_C_INCLUDES := $(LOCAL_PATH)/../../../Classes

LOCAL_STATIC_LIBRARIES := cocos2d_js_static


# 加入引用库
LOCAL_STATIC_LIBRARIES += cocos_curl_static


LOCAL_EXPORT_CFLAGS := -DCOCOS2D_DEBUG=2 -DCOCOS2D_JAVASCRIPT

include $(BUILD_SHARED_LIBRARY)


$(call import-module, scripting/js-bindings/proj.android)


# 加入引用库，这个 libcurl 支持 android-19
$(call import-module, external/curl/prebuilt/android)
