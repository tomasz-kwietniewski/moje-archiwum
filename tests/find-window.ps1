param([int]$ProcessId)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeWindowLookup {
    private delegate bool Callback(IntPtr handle, IntPtr data);
    [DllImport("user32.dll")] private static extern bool EnumWindows(Callback callback, IntPtr data);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
    public static long[] Find(uint processId) {
        var result = new System.Collections.Generic.List<long>();
        EnumWindows((handle, data) => {
            uint owner;
            GetWindowThreadProcessId(handle, out owner);
            if (owner == processId && IsWindowVisible(handle)) result.Add(handle.ToInt64());
            return true;
        }, IntPtr.Zero);
        return result.ToArray();
    }
}
'@
[NativeWindowLookup]::Find([uint32]$ProcessId) | ForEach-Object { Write-Output $_ }
