# Define directories to process
$directories = @(
    "speech",
    "stores",
    "storage",
    "vector-stores",
    "deployers",
    "integrations"
)

# Process each main directory
foreach ($dir in $directories) {
    Write-Host "`nProcessing $dir directory..."
    
    if (Test-Path $dir) {
        Set-Location $dir
        
        # Process all subdirectories
        Get-ChildItem -Directory | ForEach-Object {
            Write-Host "Running fix-verbatim-module-syntax in $dir/$_"
            Set-Location $_.Name
            npx fix-verbatim-module-syntax ./tsconfig.json
            Set-Location ..
        }
        
        Set-Location ..
    } else {
        Write-Host "Directory $dir not found, skipping..."
    }
} 