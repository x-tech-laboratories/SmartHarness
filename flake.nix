{
  description = "SmartHarness: a task-tree harness for small, locally run language models";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      # The CUDA runtime that node-llama-cpp loads is unfree.
      pkgs = import nixpkgs { inherit system; config.allowUnfree = true; };
    in
    {
      devShells.${system}.default = import ./shell.nix { inherit pkgs; };
    };
}
