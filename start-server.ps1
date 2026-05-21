$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4180
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
$listener.Start()
Write-Host "Online em http://127.0.0.1:$port/index.html"

function Get-ContentType($path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".csv" { "text/csv; charset=utf-8" }
    default { "application/octet-stream" }
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") {}

      $target = "index.html"
      if ($requestLine -match "^[A-Z]+\s+([^\s]+)") {
        $target = [System.Uri]::UnescapeDataString($matches[1].Split("?")[0]).TrimStart("/")
        if ([string]::IsNullOrWhiteSpace($target)) { $target = "index.html" }
      }

      $file = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $target))
      if (-not $file.StartsWith($root) -or -not [System.IO.File]::Exists($file)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("not found")
        $header = "HTTP/1.1 404 Not Found`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
      } else {
        $body = [System.IO.File]::ReadAllBytes($file)
        $type = Get-ContentType $file
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
