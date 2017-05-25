@echo off
set binDir=%~dp0
%~d0
cd %~dp0
cd ../lib
%binDir%node.exe patch.js %*