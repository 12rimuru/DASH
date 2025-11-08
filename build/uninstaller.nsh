!macro customUnInstall
  ; Ensure we operate on current user context for AppData
  SetShellVarContext current
  ; Delete Electron userData directory under Roaming AppData
  RMDir /r "$APPDATA\${APP_FILENAME}"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_PACKAGE_NAME
    RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
  !endif
  ; Also try LocalAppData in case any caches/logs were stored there
  RMDir /r "$LOCALAPPDATA\${APP_FILENAME}"
  !ifdef APP_PRODUCT_FILENAME
    RMDir /r "$LOCALAPPDATA\${APP_PRODUCT_FILENAME}"
  !endif
  !ifdef APP_PACKAGE_NAME
    RMDir /r "$LOCALAPPDATA\${APP_PACKAGE_NAME}"
  !endif
!macroend