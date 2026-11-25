{ pkgs ? import <nixpkgs> { config.allowUnfree = true; } }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24 # Builds and tests the library.
    git
    util-linux # flock, for the shared GPU lock around evals.
  ];
  # node-llama-cpp's prebuilt CUDA build needs the CUDA runtime and the driver's libcuda; without them it falls back to the CPU.
  LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
    pkgs.cudaPackages.cuda_cudart
    pkgs.cudaPackages.libcublas
    pkgs.stdenv.cc.cc.lib
  ] + ":/run/opengl-driver/lib";
}
