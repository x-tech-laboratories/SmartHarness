{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24 # Builds and tests the library.
    git
  ];
}
