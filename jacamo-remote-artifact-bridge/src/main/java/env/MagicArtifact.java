package env;

import cartago.Artifact;
import cartago.IArtifactOp;

public class MagicArtifact extends Artifact {

    void init() {
        System.out.println("JaCaMagic: MagicArtifact initialized");

        defineOp(new IArtifactOp() {

            @Override
            public String getName() {
                return "echo";
            }

            @Override
            public int getNumParameters() {
                return 1;
            }

            @Override
            public boolean isVarArgs() {
                return false;
            }

            @Override
            public void exec(Object[] actualParams) throws Exception {
                if (actualParams.length != 1) {
                    signal("magic_error", "echo expects 1 parameter");
                    return;
                }

                Object message = actualParams[0];

                System.out.println("JaCaMagic: dynamic operation echo called with: " + message);

                signal("echo_result", message);
            }
        }, null);

        System.out.println("JaCaMagic: dynamic operation registered: echo/1");
    }
}